"use client";

import {
  Activity,
  Braces,
  Database,
  FileText,
  Globe,
  ImageIcon,
  PackageOpen,
  Table,
  ToyBrick,
} from "lucide-react";
import RadialOrbitalTimeline from "@/components/ui/radial-orbital-timeline";

const timelineData = [
  {
    id: 1,
    title: "Dataset Image",
    date: "dataset.image",
    content:
      "Add an image dataset node. proto-ML will infer structure, generate the dataset loader, and expose clean tensor-ready outputs.",
    category: "dataset.image",
    icon: ImageIcon,
    relatedIds: [2, 4],
    status: "completed",
    energy: 100,
  },
  {
    id: 2,
    title: "Dataset CSV",
    date: "dataset.csv",
    content:
      "Add a CSV dataset node. proto-ML prepares feature columns and generates ingestion code compatible with your pipeline graph.",
    category: "dataset.csv",
    icon: Table,
    relatedIds: [1, 5],
    status: "completed",
    energy: 88,
  },
  {
    id: 3,
    title: "Dataset Text",
    date: "dataset.text",
    content:
      "Add a text dataset node. proto-ML builds a text ingestion adapter and connects it to transforms and model training.",
    category: "dataset.text",
    icon: FileText,
    relatedIds: [2, 6],
    status: "in-progress",
    energy: 64,
  },
  {
    id: 4,
    title: "Transform Basic",
    date: "transform.basic",
    content:
      "Start with basic transforms. proto-ML lets you define simple preprocessing steps and wire them into your execution graph.",
    category: "transform.basic",
    icon: Activity,
    relatedIds: [1, 3],
    status: "in-progress",
    energy: 54,
  },
  {
    id: 5,
    title: "Transform Advanced",
    date: "transform.advanced",
    content:
      "Use advanced transforms: richer pipelines, branching logic, and domain-aware operations—still driven by the visual graph.",
    category: "transform.advanced",
    icon: ToyBrick,
    relatedIds: [2, 4, 6],
    status: "pending",
    energy: 34,
  },
  {
    id: 6,
    title: "Lifecycle",
    date: "lifecycle",
    content:
      "Configure lifecycle steps: training, execution, and validation. proto-ML generates aligned execution code from your nodes.",
    category: "lifecycle",
    icon: PackageOpen,
    relatedIds: [3, 5],
    status: "pending",
    energy: 18,
  },
];

export function ProjectTimelineDemo() {
  return <RadialOrbitalTimeline timelineData={timelineData} />;
}
