import { TreeNode } from "@/types";

// Collect all file URLs recursively from the provided currentFolder tree.
export const collectUrls = (nodes?: TreeNode[]): string[] => {
  if (!nodes || nodes.length === 0) return [];
  const urls: string[] = [];
  const stack: TreeNode[] = [...nodes];

  while (stack.length) {
    const node = stack.shift()!;

    if (!node) continue;
    if (node.type === "file" && node.url) {
      urls.push(node.url);
    } else if (
      node.type === "folder" &&
      node.children &&
      node.children.length > 0
    ) {
      stack.push(...node.children);
    }
  }

  return urls;
};

export const findNodeInTree = (
  nodes: TreeNode[],
  name: string,
): TreeNode | undefined => {
  for (const node of nodes) {
    if (node.name === name) {
      return node;
    }
    if (node.type === "folder" && node.children) {
      const found = findNodeInTree(node.children, name);

      if (found) return found;
    }
  }

  return undefined;
};
export const convertUrlsToTree = (urls: string[]): TreeNode[] => {
  const tree: TreeNode[] = [];

  urls.forEach((url) => {
    // Derive the key/path from the full URL without relying on any env var.
    // Prefer using the URL API to extract the pathname (works for both S3 and CloudFront domains).
    let pathParts: string[] = [];

    try {
      const parsed = new URL(url);

      pathParts = parsed.pathname.replace(/^\/+/, "").split("/");
    } catch {
      // Fallback: strip protocol + domain if URL parsing fails
      const withoutDomain = url.replace(/^[^:]+:\/\/[^/]+\/?/, "");

      pathParts = withoutDomain.split("/");
    }
    let currentLevel = tree;

    pathParts.forEach((part, index) => {
      let existingNode = currentLevel.find(
        (node) =>
          node.name === part &&
          (index === pathParts.length - 1
            ? node.type === "file"
            : node.type === "folder"),
      );

      if (!existingNode) {
        existingNode = {
          name: part,
          type: index === pathParts.length - 1 ? "file" : "folder",
          ...(index === pathParts.length - 1 && { url: url }),
          ...(index !== pathParts.length - 1 && { children: [] }),
        };
        currentLevel.push(existingNode);
      }

      if (existingNode.type === "folder") {
        currentLevel = existingNode.children!;
      }
    });
  });

  return tree;
};
