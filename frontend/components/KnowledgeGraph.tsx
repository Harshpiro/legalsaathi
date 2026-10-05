"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  ReactFlowInstance,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  Position,
} from "reactflow";
import "reactflow/dist/style.css";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  SimulationNodeDatum,
  SimulationLinkDatum,
} from "d3-force";
import { useApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Network, User, BookOpen, FileText, Maximize2, Minimize2, LocateFixed, RefreshCw } from "lucide-react";

// ── Custom Node Components ──

function PersonNode({ data }: { data: any }) {
  const size = Math.max(40, Math.min(80, 40 + (data.connections || 0) * 6));
  return (
    <div className="group relative">
      <Handle type="target" position={Position.Left} className="!bg-blue-500 !border-blue-400" />
      <div
        className="rounded-full flex items-center justify-center shadow-lg shadow-blue-500/20 border-2 border-blue-400/50 bg-gradient-to-br from-blue-500 to-blue-700 text-white transition-all duration-200 hover:scale-110 hover:shadow-blue-500/40 cursor-pointer"
        style={{ width: size, height: size }}
      >
        <User className="w-5 h-5" />
      </div>
      <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 max-w-[150px] truncate text-[10px] font-medium text-blue-200 bg-slate-950/90 px-2 py-1 rounded-md border border-blue-500/20 shadow-lg">
        {data.label}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-blue-500 !border-blue-400" />
    </div>
  );
}

function SectionNode({ data }: { data: any }) {
  return (
    <div className="group relative">
      <Handle type="target" position={Position.Left} className="!bg-purple-500 !border-purple-400" />
      <div className="max-w-[260px] px-3 py-2 rounded-md shadow-lg shadow-purple-500/20 border border-purple-300/50 bg-gradient-to-br from-purple-500 to-violet-700 text-white text-[11px] font-semibold leading-snug transition-all duration-200 hover:scale-[1.03] hover:shadow-purple-500/40 cursor-pointer flex items-start gap-2">
        <BookOpen className="w-3.5 h-3.5" />
        <span className="line-clamp-2">{data.label}</span>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-purple-500 !border-purple-400" />
    </div>
  );
}

function DocumentNode({ data }: { data: any }) {
  return (
    <div className="group relative">
      <Handle type="target" position={Position.Left} className="!bg-amber-500 !border-amber-400" />
      <div className="w-16 h-16 rotate-45 flex items-center justify-center shadow-lg shadow-amber-500/30 border-2 border-amber-400/50 bg-gradient-to-br from-amber-500 to-orange-600 transition-all duration-200 hover:scale-110 hover:shadow-amber-500/50 cursor-pointer">
        <FileText className="w-6 h-6 text-slate-950 -rotate-45" />
      </div>
      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 max-w-[180px] truncate text-[10px] font-semibold text-amber-300 bg-slate-950/90 px-2 py-1 rounded-md border border-amber-500/20 shadow-lg">
        {data.label}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-amber-500 !border-amber-400" />
    </div>
  );
}

const nodeTypes = {
  person: PersonNode,
  party: PersonNode,
  section: SectionNode,
  date: SectionNode,
  amount: SectionNode,
  document: DocumentNode,
};

// ── D3-Force Layout ──

interface D3Node extends SimulationNodeDatum {
  id: string;
}

function layoutWithForce(
  rawNodes: { id: string; type: string; label: string; connections: number }[],
  rawEdges: { source: string; target: string; label: string }[]
): { nodes: Node[]; edges: Edge[] } {
  const spread = Math.max(520, rawNodes.length * 42);
  const phase = Math.random() * Math.PI * 2;
  const d3Nodes: D3Node[] = rawNodes.map((n, index) => ({
    id: n.id,
    x: Math.cos(index * 1.9 + phase) * spread * 0.35 + spread * 0.5,
    y: Math.sin(index * 1.9 + phase) * spread * 0.28 + 300,
  }));

  const d3Links: SimulationLinkDatum<D3Node>[] = rawEdges.map((e) => ({
    source: e.source,
    target: e.target,
  }));

  // Run simulation synchronously
  const simulation = forceSimulation(d3Nodes)
    .force("link", forceLink<D3Node, SimulationLinkDatum<D3Node>>(d3Links).id((d) => d.id).distance(190).strength(0.6))
    .force("charge", forceManyBody().strength(-620))
    .force("center", forceCenter(spread * 0.5, 320))
    .force("collide", forceCollide(95))
    .stop();

  for (let i = 0; i < 420; i++) simulation.tick();

  const nodeMap = new Map(d3Nodes.map((n) => [n.id, n]));

  const nodes: Node[] = rawNodes.map((rn) => {
    const pos = nodeMap.get(rn.id)!;
    const type = ["person", "party", "section", "date", "amount", "document"].includes(rn.type)
      ? rn.type
      : "section";
    return {
      id: rn.id,
      type,
      position: { x: pos.x || 0, y: pos.y || 0 },
      data: { label: rn.label, connections: rn.connections },
      className: "transition-transform duration-500 ease-out",
    };
  });

  const edges: Edge[] = rawEdges.map((re, i) => ({
    id: `e-${i}`,
    source: re.source,
    target: re.target,
    label: re.label,
    type: "smoothstep",
    animated: true,
    style: {
      stroke: re.label === "MENTIONS" || re.label === "HAS_PARTY" ? "#60a5fa" : re.label === "CITES" || re.label === "HAS_CLAUSE" ? "#a78bfa" : "#f59e0b",
      strokeWidth: 2.4,
      opacity: 0.85,
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: re.label === "MENTIONS" || re.label === "HAS_PARTY" ? "#60a5fa" : re.label === "CITES" || re.label === "HAS_CLAUSE" ? "#a78bfa" : "#f59e0b",
    },
    labelStyle: { fill: "#94a3b8", fontSize: 10, fontWeight: 600 },
    labelBgStyle: { fill: "#0f172a", fillOpacity: 0.8 },
    labelBgPadding: [4, 2] as [number, number],
  }));

  return { nodes, edges };
}

// ── Main Component ──

interface KnowledgeGraphProps {
  documentId: string;
}

export function KnowledgeGraph({ documentId }: KnowledgeGraphProps) {
  const api = useApi();
  const graphRef = useRef<HTMLDivElement | null>(null);
  const [flow, setFlow] = useState<ReactFlowInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [rawGraph, setRawGraph] = useState<{ nodes: any[]; edges: any[] } | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { data } = await api.get(`/api/graph/${documentId}`);

        if (!data.nodes || data.nodes.length === 0) {
          setError("Is document ke liye koi entity nahi mili. FIR ya court notice upload karein — entities automatically extract hongi.");
          return;
        }

        setRawGraph({ nodes: data.nodes, edges: data.edges });
        const layout = layoutWithForce(data.nodes, data.edges);
        setNodes(layout.nodes);
        setEdges(layout.edges);
      } catch (e: any) {
        setError(e?.response?.data?.detail ?? "Graph load nahi ho paya");
      } finally {
        setLoading(false);
      }
    })();
  }, [api, documentId, setEdges, setNodes]);

  useEffect(() => {
    const onFullscreenChange = () => {
      const active = document.fullscreenElement === graphRef.current;
      setIsFullscreen(active);
      window.setTimeout(() => flow?.fitView({ padding: active ? 0.12 : 0.25, duration: 500 }), 80);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, [flow]);

  const fitGraph = useCallback(() => {
    flow?.fitView({ padding: 0.2, duration: 500 });
  }, [flow]);

  const relayoutGraph = useCallback(() => {
    if (!rawGraph) return;
    const layout = layoutWithForce(rawGraph.nodes, rawGraph.edges);
    setNodes(layout.nodes);
    setEdges(layout.edges);
    window.setTimeout(() => flow?.fitView({ padding: 0.2, duration: 500 }), 60);
  }, [flow, rawGraph, setEdges, setNodes]);

  const toggleFullscreen = useCallback(async () => {
    if (!graphRef.current) return;
    if (document.fullscreenElement === graphRef.current) {
      await document.exitFullscreen();
    } else {
      await graphRef.current.requestFullscreen();
    }
  }, []);

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNode(node.data);
    setEdges((eds) =>
      eds.map((e) => ({
        ...e,
        style: {
          ...e.style,
          strokeWidth: e.source === node.id || e.target === node.id ? 4 : 2.4,
          opacity: e.source === node.id || e.target === node.id ? 1 : 0.3,
        },
      }))
    );
  }, [setEdges]);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setEdges((eds) =>
      eds.map((e) => ({
        ...e,
        style: { ...e.style, strokeWidth: 2.4, opacity: 0.85 },
      }))
    );
  }, [setEdges]);

  if (loading) {
    return (
      <Card className="h-[500px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">Knowledge graph load ho raha hai…</p>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="h-[500px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center px-6">
          <Network className="h-10 w-10 text-slate-600" />
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </Card>
    );
  }

  return (
    <Card ref={graphRef} className={`overflow-hidden bg-slate-950/80 border-slate-800 ${isFullscreen ? "fixed inset-0 z-50 rounded-none" : ""}`}>
      <CardHeader className="pb-3 border-b border-slate-800/80 bg-slate-950/80">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Network className="w-5 h-5 text-amber-500" />
            Knowledge Graph
            <span className="text-xs font-normal text-muted-foreground ml-2">
              {nodes.length} nodes · {edges.length} edges
            </span>
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={fitGraph} title="Fit graph">
              <LocateFixed className="h-4 w-4" />
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={relayoutGraph} title="Re-layout graph">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={toggleFullscreen} title="Fullscreen graph">
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className={`${isFullscreen ? "h-[calc(100vh-73px)]" : "h-[620px]"} w-full bg-slate-950 relative`}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onInit={setFlow}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.25 }}
            minZoom={0.15}
            maxZoom={1.8}
            nodesDraggable
            panOnScroll
            selectionOnDrag
            onlyRenderVisibleElements
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#334155" gap={22} size={1} />
            <Controls
              className="!bg-slate-800 !border-slate-700 !rounded-lg !shadow-lg [&>button]:!bg-slate-800 [&>button]:!border-slate-700 [&>button]:!text-slate-300 [&>button:hover]:!bg-slate-700"
            />
            <MiniMap
              nodeColor={(n) =>
                n.type === "person" || n.type === "party" ? "#3b82f6" : n.type === "section" || n.type === "date" || n.type === "amount" ? "#8b5cf6" : "#f59e0b"
              }
              maskColor="rgb(15 23 42 / 0.8)"
              pannable
              zoomable
              className="!bg-slate-900 !border-slate-700 !rounded-md"
            />
          </ReactFlow>

          {selectedNode && (
            <div className="absolute top-4 right-4 bg-slate-950/95 backdrop-blur-md border border-slate-700 rounded-md p-4 max-w-[260px] shadow-xl">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Selected</p>
              <p className="text-sm font-bold text-white">{selectedNode.label}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {selectedNode.connections} connections
              </p>
            </div>
          )}

          <div className="absolute bottom-4 left-4 bg-slate-950/90 backdrop-blur-md border border-slate-700 rounded-md px-3 py-2 flex gap-4 text-[10px] shadow-lg">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-blue-500" /> Party/Person
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-purple-500" /> Clause/Detail
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rotate-45 bg-amber-500" /> Document
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
