import Graph from 'graphology';

export function calculateDegreeCentrality(graph: Graph): Map<string, number> {
  const centrality = new Map<string, number>();

  graph.forEachNode((node) => {
    const degree = graph.degree(node);
    centrality.set(node, degree);
  });

  return centrality;
}

export function getTopKNodesByDegreeCentrality(graph: Graph, k: number): string[] {
  const centrality = calculateDegreeCentrality(graph);
  
  return Array.from(centrality.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([node]) => node);
}

export function calculateBetweennessCentrality(graph: Graph): Map<string, number> {
  const betweenness = new Map<string, number>();
  const nodes = graph.nodes();

  // Initialize betweenness centrality for all nodes to 0
  nodes.forEach(node => betweenness.set(node, 0));

  // Iterate through all pairs of nodes
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const source = nodes[i];
      const target = nodes[j];

      // Find all shortest paths between source and target
      const shortestPaths = findAllShortestPaths(graph, source, target);

      // Update betweenness for nodes on the shortest paths
      if (shortestPaths.length > 0) {
        shortestPaths.forEach(path => {
          for (let k = 1; k < path.length - 1; k++) {
            const intermediateNode = path[k];
            betweenness.set(
              intermediateNode,
              (betweenness.get(intermediateNode) || 0) + 1 / shortestPaths.length
            );
          }
        });
      }
    }
  }

  // Normalize betweenness values
  const n = nodes.length;
  nodes.forEach(node => {
    betweenness.set(node, (betweenness.get(node) || 0) / ((n - 1) * (n - 2) / 2));
  });

  return betweenness;
}

function findAllShortestPaths(graph: Graph, source: string, target: string): string[][] {
  const queue: [string, string[]][] = [[source, [source]]];
  const shortestPaths: string[][] = [];
  const visited = new Set<string>();
  let shortestLength = Infinity;

  while (queue.length > 0) {
    const [node, path] = queue.shift()!;

    if (node === target) {
      if (path.length < shortestLength) {
        shortestPaths.length = 0;
        shortestLength = path.length;
      }
      if (path.length === shortestLength) {
        shortestPaths.push(path);
      }
      continue;
    }

    if (path.length > shortestLength) {
      continue;
    }

    visited.add(node);

    graph.forEachNeighbor(node, (neighbor: string) => {
      if (!visited.has(neighbor)) {
        queue.push([neighbor, [...path, neighbor]]);
      }
    });
  }

  return shortestPaths;
}

// Function to get top K nodes by betweenness centrality
export function getTopKNodesByBetweennessCentrality(graph: Graph, k: number): string[] {
  const betweenness = calculateBetweennessCentrality(graph);
  return Array.from(betweenness.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(entry => entry[0]);
}