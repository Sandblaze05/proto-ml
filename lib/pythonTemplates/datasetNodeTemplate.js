function pyString(v) {
  const s = String(v ?? '');
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function pyValue(v) {
  if (v === null || v === undefined) return 'None';
  if (typeof v === 'boolean') return v ? 'True' : 'False';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'None';
  if (typeof v === 'string') return pyString(v);
  if (Array.isArray(v)) return `[${v.map((it) => pyValue(it)).join(', ')}]`;
  if (typeof v === 'object') {
    const entries = Object.entries(v).map(([k, val]) => `${pyString(k)}: ${pyValue(val)}`);
    return `{${entries.join(', ')}}`;
  }
  return pyString(String(v));
}

function imageTemplate(config) {
  return [
    '# Auto-generated template for dataset.image',
    'from pathlib import Path',
    'from torchvision import datasets',
    '',
    `config = ${pyValue(config)}`,
    `dataset_root = Path(${pyValue(config.path || './data/images')})`,
    'dataset = datasets.ImageFolder(root=str(dataset_root))',
    '# NOTE: transforms are applied by separate transform nodes in the graph',
    'print(f"Loaded image dataset with {len(dataset)} samples")',
  ].join('\n');
}

function csvTemplate(config) {
  return [
    '# Auto-generated template for dataset.csv',
    'import pandas as pd',
    '',
    `config = ${pyValue(config)}`,
    `path = ${pyValue(config.path || './data/data.csv')}`,
    `delimiter = ${pyValue(config.delimiter || ',')}`,
    `has_header = ${pyValue(config.header !== false)}`,
    '',
    'df = pd.read_csv(path, sep=delimiter, header=0 if has_header else None)',
    `target_column = ${pyValue(config.target_column || '')}`,
    "if target_column and target_column in df.columns:",
    '    y = df[target_column]',
    '    X = df.drop(columns=[target_column])',
    'else:',
    '    y = None',
    '    X = df',
    '',
    'print(f"CSV rows: {len(df)}, columns: {len(df.columns)}")',
  ].join('\n');
}

function textTemplate(config) {
  return [
    '# Auto-generated template for dataset.text',
    'import json',
    'from pathlib import Path',
    '',
    `config = ${pyValue(config)}`,
    `path = Path(${pyValue(config.path || './data/corpus.txt')})`,
    `file_format = ${pyValue(config.file_format || 'txt')}`,
    `text_column = ${pyValue(config.text_column || 'text')}`,
    `label_column = ${pyValue(config.label_column || 'label')}`,
    '',
    'records = []',
    "if file_format == 'txt':",
    "    records = [{'text': line.strip()} for line in path.read_text(encoding='utf-8').splitlines() if line.strip()]",
    "elif file_format == 'jsonl':",
    "    for line in path.read_text(encoding='utf-8').splitlines():",
    '        line = line.strip()',
    '        if not line:',
    '            continue',
    '        obj = json.loads(line)',
    "        records.append({'text': obj.get(text_column, ''), 'label': obj.get(label_column)})",
    'else:',
    "    # csv fallback",
    '    import csv',
    "    with path.open('r', encoding='utf-8', newline='') as f:",
    '        reader = csv.DictReader(f)',
    '        for row in reader:',
    "            records.append({'text': row.get(text_column, ''), 'label': row.get(label_column)})",
    '',
    'print(f"Text records: {len(records)}")',
  ].join('\n');
}

function jsonTemplate(config) {
  return [
    '# Auto-generated template for dataset.json',
    'import json',
    'from pathlib import Path',
    '',
    `config = ${pyValue(config)}`,
    `path = Path(${pyValue(config.path || './data/data.json')})`,
    `file_format = ${pyValue(config.file_format || 'json')}`,
    `data_key = ${pyValue(config.data_key || '')}`,
    '',
    'def get_by_path(obj, dot_path):',
    '    if not dot_path:',
    '        return obj',
    '    cur = obj',
    "    for part in dot_path.split('.'):",
    '        if isinstance(cur, dict):',
    '            cur = cur.get(part)',
    '        else:',
    '            return None',
    '    return cur',
    '',
    "if file_format == 'jsonl':",
    "    records = [json.loads(line) for line in path.read_text(encoding='utf-8').splitlines() if line.strip()]",
    'else:',
    "    payload = json.loads(path.read_text(encoding='utf-8'))",
    '    extracted = get_by_path(payload, data_key)',
    '    if isinstance(extracted, list):',
    '        records = extracted',
    '    elif isinstance(payload, list):',
    '        records = payload',
    '    else:',
    '        records = [extracted if extracted is not None else payload]',
    '',
    'print(f"JSON records: {len(records)}")',
  ].join('\n');
}

function databaseTemplate(config) {
  return [
    '# Auto-generated template for dataset.database',
    '# NOTE: This is a template scaffold. Executor integration will provide connectors.',
    '',
    `config = ${pyValue(config)}`,
    `db_type = ${pyValue(config.db_type || 'postgresql')}`,
    `host = ${pyValue(config.host || 'localhost')}`,
    `database = ${pyValue(config.database || '')}`,
    `table = ${pyValue(config.table || '')}`,
    `query = ${pyValue(config.query || '')}`,
    '',
    'if query:',
    '    sql = query',
    'elif table:',
    '    sql = f"SELECT * FROM {table}"',
    'else:',
    '    sql = None',
    '',
    'print(f"DB type: {db_type}, host: {host}, database: {database}")',
    'print(f"Query: {sql}")',
  ].join('\n');
}

function apiTemplate(config) {
  return [
    '# Auto-generated template for dataset.api',
    'import requests',
    '',
    `config = ${pyValue(config)}`,
    `url = ${pyValue(config.url || '')}`,
    `method = ${pyValue(config.method || 'GET')}`,
    `auth_type = ${pyValue(config.auth_type || 'none')}`,
    `token = ${pyValue(config.auth_token || '')}`,
    '',
    'headers = {}',
    "if auth_type == 'bearer' and token:",
    '    headers["Authorization"] = f"Bearer {token}"',
    '',
    'resp = requests.request(method=method, url=url, headers=headers, timeout=30)',
    'resp.raise_for_status()',
    'payload = resp.json()',
    `data_path = ${pyValue(config.data_path || 'data')}`,
    '# TODO: extract nested payload by data_path in executor runtime',
    'print("Fetched payload keys:", list(payload.keys()) if isinstance(payload, dict) else type(payload))',
  ].join('\n');
}

export function generateDatasetPythonCode(nodeType, config = {}) {
  switch (nodeType) {
    case 'dataset.image':
      return imageTemplate(config);
    case 'dataset.csv':
      return csvTemplate(config);
    case 'dataset.text':
      return textTemplate(config);
    case 'dataset.json':
      return jsonTemplate(config);
    case 'dataset.database':
      return databaseTemplate(config);
    case 'dataset.api':
      return apiTemplate(config);
    default:
      return [
        '# Auto-generated dataset template',
        `# Unknown node type: ${nodeType}`,
        `config = ${pyValue(config)}`,
      ].join('\n');
  }
}
