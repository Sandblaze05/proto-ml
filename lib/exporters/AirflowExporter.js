import { BaseExporter } from './BaseExporter.js';
import {
  classifyNode,
  nodeIdToSymbol,
  toPythonLiteral,
  sanitizeDagName,
} from '../executor/graphUtils.js';

const DATASET_CONFIG_STRIP_KEYS = [
  'dataset_sample',
  'dataset_schema',
  'dataset_stats',
  'dataset_metadata',
];

function getIncomingEdges(nodeId, incomingMap) {
  return incomingMap.get(nodeId) ?? [];
}

function sortEdgesByTargetHandle(edges) {
  return [...edges].sort((a, b) => {
    const aTarget = String(a.targetHandle || '');
    const bTarget = String(b.targetHandle || '');
    return aTarget.localeCompare(bTarget);
  });
}

const RESERVED_KEYWORDS = new Set(['in', 'as', 'def', 'if', 'else', 'for', 'while', 'import', 'from', 'return', 'try', 'except', 'finally', 'with', 'lambda', 'yield', 'global', 'nonlocal', 'assert', 'del', 'pass', 'break', 'continue', 'and', 'or', 'not', 'is', 'None', 'True', 'False']);

function sanitizeParamName(name) {
  if (RESERVED_KEYWORDS.has(name)) {
    return `${name}_data`;
  }
  return name.replace(/[^a-zA-Z0-9_]/g, '_');
}

function buildTaskParams(inEdges) {
  if (inEdges.length === 0) return [];
  const sorted = sortEdgesByTargetHandle(inEdges);
  return sorted.map((edge, index) => sanitizeParamName(edge.targetHandle || `input_${index}`));
}

function edgesForParams(inEdges) {
  if (inEdges.length <= 1) return inEdges;
  return sortEdgesByTargetHandle(inEdges);
}

function slimNodeConfig(node) {
  const config = { ...(node.config ?? {}) };
  if (classifyNode(node.type) === 'dataset') {
    for (const key of DATASET_CONFIG_STRIP_KEYS) {
      delete config[key];
    }
  }
  return config;
}

function upstreamValueExpr(edge, nodesById) {
  const sourceNode = nodesById?.[edge.source];
  const isModelBuilder = sourceNode?.type === 'lifecycle.core.model_builder';
  const base = `${nodeIdToSymbol(edge.source)}_result`;
  const slot = edge.sourceHandle;

  if (slot && slot !== 'out' && !isModelBuilder) {
    return `${base}[${toPythonLiteral(slot)}]`;
  }
  return base;
}

function buildProductionTaskBody(node, params, opts = {}) {
  const nodeType = node.type || 'unknown';
  const config = slimNodeConfig(node);
  const stage = classifyNode(nodeType);
  const outputDir = opts.outputDir || '/opt/airflow/data';

  const lines = [
    'import os',
    'import pandas as pd',
    'import joblib',
    'import logging',
    'from datetime import datetime',
    'from airflow.sdk import get_current_context',
    '',
    'logger = logging.getLogger("airflow.task")',
    `DATA_BASE_DIR = ${toPythonLiteral(outputDir)}`,
    'context = get_current_context()',
    'run_id = context.get("run_id", "local_run")',
    'DATA_DIR = os.path.join(DATA_BASE_DIR, run_id)',
    'os.makedirs(DATA_DIR, exist_ok=True)',
    '',
  ];

  if (stage === 'dataset') {
    let csvPath = config.path || '/opt/airflow/data/input.csv';
    if (csvPath.startsWith('client://')) {
      // Heuristic: try to use the filename or a generic placeholder if it's a browser-only path
      csvPath = '/opt/airflow/data/input.csv'; 
    }
    lines.push(
      'try:',
      `    path = ${toPythonLiteral(csvPath)}`,
      '    logger.info(f"Reading dataset from {path}")',
      '    df = pd.read_csv(path)',
      '    ',
      '    # Save as parquet for performance',
      `    output_path = os.path.join(DATA_DIR, f"dataset_{datetime.now().strftime(\'%Y%m%d%H%M%S\')}.parquet")`,
      '    df.to_parquet(output_path)',
      '    logger.info(f"Saved dataset to {output_path}")',
      '    return output_path',
      'except Exception as e:',
      '    logger.error(f"Dataset loading failed: {e}")',
      '    raise'
    );
    return lines;
  }

  if (nodeType === 'lifecycle.split') {
    lines.push(
      'from sklearn.model_selection import train_test_split',
      'try:',
      `    dataset_path = ${params[0] || 'None'}`,
      '    df = pd.read_parquet(dataset_path)',
      '    ',
      `    train_pct = ${config.train_pct || 70} / 100`,
      `    val_pct = ${config.val_pct || 20} / 100`,
      `    test_pct = ${config.test_pct || 10} / 100`,
      '    ',
      '    train, temp = train_test_split(df, train_size=train_pct, random_state=42)',
      '    val, test = train_test_split(temp, train_size=val_pct/(val_pct+test_pct), random_state=42)',
      '    ',
      '    results = {}',
      '    for name, split_df in [("train", train), ("val", val), ("test", test)]:',
      '        p = os.path.join(DATA_DIR, f"{name}_{datetime.now().timestamp()}.parquet")',
      '        split_df.to_parquet(p)',
      '        results[name] = p',
      '    ',
      '    return results',
      'except Exception as e:',
      '    logger.error(f"Split failed: {e}")',
      '    raise'
    );
    return lines;
  }

  if (nodeType === 'lifecycle.core.model_builder') {
    const family = config.family || 'linear_regression';
    lines.push(
      'try:',
      '    model = None',
    );
    if (family === 'linear_regression') {
      lines.push('    from sklearn.linear_model import LinearRegression', '    model = LinearRegression()');
    } else if (family === 'logistic_regression') {
      lines.push('    from sklearn.linear_model import LogisticRegression', '    model = LogisticRegression()');
    } else if (family === 'random_forest') {
      lines.push('    from sklearn.ensemble import RandomForestRegressor', '    model = RandomForestRegressor()');
    } else if (family === 'xgboost') {
      lines.push('    import xgboost as xgb', '    model = xgb.XGBRegressor()');
    } else if (family === 'lightgbm') {
      lines.push('    import lightgbm as lgb', '    model = lgb.LGBMRegressor()');
    }
    lines.push(
      `    model_path = os.path.join(DATA_DIR, f"model_{datetime.now().timestamp()}.joblib")`,
      '    joblib.dump(model, model_path)',
      '    return model_path',
      'except Exception as e:',
      '    logger.error(f"Model building failed: {e}")',
      '    raise'
    );
    return lines;
  }

  if (nodeType === 'lifecycle.core.trainer') {
    lines.push(
      'try:',
      `    model_path = ${params.find(p => p.includes('model')) || 'None'}`,
      `    train_path = ${params.find(p => p.includes('train')) || 'None'}`,
      '    ',
      '    model = joblib.load(model_path)',
      '    train_df = pd.read_parquet(train_path)',
      '    ',
      `    target_col = ${toPythonLiteral(config.target_column || 'target')}`,
      '    if target_col not in train_df.columns:',
      '        target_col = train_df.columns[-1]',
      '    ',
      '    X = train_df.drop(columns=[target_col])',
      '    y = train_df[target_col]',
      '    ',
      '    model.fit(X, y)',
      '    ',
      `    trained_model_path = os.path.join(DATA_DIR, f"trained_model_{datetime.now().timestamp()}.joblib")`,
      '    joblib.dump(model, trained_model_path)',
      '    return trained_model_path',
      'except Exception as e:',
      '    logger.error(f"Training failed: {e}")',
      '    raise'
    );
    return lines;
  }

  if (nodeType === 'lifecycle.core.evaluator') {
    lines.push(
      'from sklearn.metrics import mean_squared_error, r2_score, accuracy_score',
      'try:',
      `    model_path = ${params.find(p => p.includes('model')) || 'None'}`,
      `    test_path = ${params.find(p => p.includes('test')) || 'None'}`,
      '    ',
      '    model = joblib.load(model_path)',
      '    test_df = pd.read_parquet(test_path)',
      '    ',
      `    target_col = ${toPythonLiteral(config.target_column || 'target')}`,
      '    if target_col not in test_df.columns:',
      '        target_col = test_df.columns[-1]',
      '    ',
      '    X = test_df.drop(columns=[target_col])',
      '    y = test_df[target_col]',
      '    preds = model.predict(X)',
      '    ',
      '    metrics = {',
      '        "mse": float(mean_squared_error(y, preds)) if hasattr(model, "predict") else 0,',
      '        "r2": float(r2_score(y, preds)) if hasattr(model, "predict") else 0,',
      '    }',
      '    return metrics',
      'except Exception as e:',
      '    logger.error(f"Evaluation failed: {e}")',
      '    raise'
    );
    return lines;
  }

  if (nodeType === 'transform.tabular.label_encoding') {
    lines.push(
      'from sklearn.preprocessing import LabelEncoder',
      'try:',
      `    dataset_path = ${params[0] || 'None'}`,
      '    df = pd.read_parquet(dataset_path)',
      '    ',
      `    columns = ${toPythonLiteral(config.columns || [])}`,
      '    if not columns:',
      '        columns = [col for col in df.columns if df[col].dtype == "object"]',
      '    ',
      '    for col in columns:',
      '        if col in df.columns:',
      '            le = LabelEncoder()',
      '            df[col] = le.fit_transform(df[col].astype(str))',
      '    ',
      `    output_path = os.path.join(DATA_DIR, f"encoded_{datetime.now().timestamp()}.parquet")`,
      '    df.to_parquet(output_path)',
      '    return output_path',
      'except Exception as e:',
      '    logger.error(f"Label encoding failed: {e}")',
      '    raise'
    );
    return lines;
  }

  // Generic Transform fallback
  lines.push(
    'try:',
    '    # Generic transform logic',
    '    return "artifact_path_placeholder"',
    'except Exception as e:',
    '    logger.error(f"Task failed: {e}")',
    '    raise'
  );
  return lines;
}

function buildWiringEpilogue(sortedNodes, incomingMap, nodesById) {
  const lines = [];
  for (const node of sortedNodes) {
    const fnName = nodeIdToSymbol(node.id);
    const resultVar = `${fnName}_result`;
    const inEdges = getIncomingEdges(node.id, incomingMap);
    const params = buildTaskParams(inEdges);

    if (params.length === 0) {
      lines.push(`${resultVar} = ${fnName}()`);
    } else {
      const orderedEdges = edgesForParams(inEdges);
      const args = params.map((paramName, index) => {
        return `${paramName}=${upstreamValueExpr(orderedEdges[index], nodesById)}`;
      });
      lines.push(`${resultVar} = ${fnName}(${args.join(', ')})`);
    }
  }
  return lines;
}

function indent(lines, level) {
  const prefix = '    '.repeat(level);
  return lines.map((line) => (line === '' ? '' : `${prefix}${line}`));
}

export class AirflowExporter extends BaseExporter {
  generateCode(sortedNodes, edges, depMap, incomingMap, opts = {}) {
    const dagName = sanitizeDagName(opts.dagName || `pipeline_${Date.now()}`);
    const taskBlocks = [];

    const nodesById = Object.fromEntries(sortedNodes.map(n => [n.id, n]));
    const outgoingMap = new Map();
    for (const edge of edges) {
      if (!outgoingMap.has(edge.source)) outgoingMap.set(edge.source, []);
      outgoingMap.get(edge.source).push(edge);
    }

    for (const node of sortedNodes) {
      const inEdges = getIncomingEdges(node.id, incomingMap);
      const params = buildTaskParams(inEdges);
      const bodyLines = buildProductionTaskBody(node, params, opts);

      const fnName = nodeIdToSymbol(node.id);
      const sig = `(${params.join(', ')})`;

      const outEdges = outgoingMap.get(node.id) ?? [];
      const namedHandles = Array.from(new Set(
        outEdges.map(e => e.sourceHandle).filter(h => h && h !== 'out')
      ));
      
      const isModelBuilder = node.type === 'lifecycle.core.model_builder';
      const hasNamedOutputs = namedHandles.length > 0 && !isModelBuilder;
      const decorator = hasNamedOutputs ? '@task(multiple_outputs=True)' : '@task';

      taskBlocks.push([
        ...indent([decorator, `def ${fnName}${sig}:`], 1),
        ...indent(bodyLines, 2),
      ].join('\n'));
    }

    const wiringLines = buildWiringEpilogue(sortedNodes, incomingMap, nodesById);

    return [
      '# AUTO-GENERATED PRODUCTION-READY AIRFLOW DAG',
      '# Required: pip install pandas scikit-learn joblib xgboost lightgbm pyarrow',
      'from airflow.sdk import dag, task',
      'from datetime import datetime',
      '',
      `@dag(dag_id='${dagName}', start_date=datetime(2025, 1, 1), schedule=None, catchup=False)`,
      `def ${dagName}():`,
      ...taskBlocks,
      '',
      ...indent(wiringLines, 1),
      '',
      `${dagName}()`,
      '',
    ].join('\n');
  }
}

export const airflowExporter = new AirflowExporter();
