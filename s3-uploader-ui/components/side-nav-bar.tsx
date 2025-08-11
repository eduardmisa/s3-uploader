import { useSideNavBar } from "@/hooks/useSideNav";
import { ListFilesResult, listFilesFromS3 } from "@/lib/aws-s3";
import { TreeNode } from "@/types";
import { convertUrlsToTree, findNodeInTree } from "@/utils/treeUtil";
import { Button } from "@heroui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerBody } from "@heroui/drawer";
import { Input } from "@heroui/input";
import { ListboxItem, Listbox } from "@heroui/listbox";
import { useDisclosure, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, FolderIcon, FileImageIcon, HomeIcon, ChevronLeft, PlusCircleIcon } from "lucide-react";
import { useEffect, useState } from "react";

export const SideNavBar = () => {
  const {
    isSideNavOpen,
    toggleSideNav,

    setCurrentFolder: setCurrentFolderContext,
    setPathHistory: setPathHistoryContext
  } = useSideNavBar();

  const { data: s3FileData } = useQuery<ListFilesResult>({
    queryKey: ["s3Files"],
    queryFn: () => listFilesFromS3(),
  });
  useEffect(() => {
    handleAction("ROOT")
  }, [s3FileData])

  const treeData = convertUrlsToTree(s3FileData?.fileUrls || []);

  const [currentFolder, setCurrentFolder] = useState<TreeNode[]>(() => { return treeData; });
  useEffect(() => {
    setCurrentFolderContext(currentFolder);
  }, [currentFolder])

  const [pathHistory, setPathHistory] = useState<string[]>([]);
  useEffect(() => {
    setPathHistoryContext(pathHistory);
  }, [pathHistory])

  const [newFolderName, setNewFolderName] = useState("");

  const { isOpen, onOpen, onClose: onDisclosureClose } = useDisclosure();
  const onClose = () => {
    onDisclosureClose();
    setNewFolderName("");
  };
  const onCreateFolder = (name: string) => {
    currentFolder.push({
      name,
      type: "folder",
      children: [],
    });
    setCurrentFolder(currentFolder);
    setPathHistory((prev) => [...prev, name]);
    onClose();
  };

  const handleAction = (key: React.Key, newHistory?: string[]) => {
    if (key === "ROOT") {
      setCurrentFolder(treeData);
      setPathHistory([]);
    }

    if (key === "CreateFolder") {
      onOpen();
    }

    const node = findNodeInTree(treeData, key as string); // Use treeData to find the node

    if (node) {
      if (node.type === "file" && node.url) {
        window.open(node.url, "_blank");
      } else if (node.type === "folder" && node.children) {
        setCurrentFolder(node.children);
        if (!newHistory) setPathHistory((prev) => [...prev, node.name]);
        else setPathHistory([...newHistory]);
      }
    }
  };

  const handleBack = () => {
    if (pathHistory.length === 2) {
      handleAction(pathHistory[0], [pathHistory[0]]);
    } else if (pathHistory.length === 1) {
      handleAction("ROOT");
    } else {
      pathHistory.pop();
      const prev = pathHistory.pop();

      handleAction(prev!, pathHistory);
    }
  };

  const renderNodes = () => {
    return (
      <>
        {currentFolder.map((node) => (
          <ListboxItem
            key={node.name}
            endContent={node.type === "folder" ? <ChevronRight /> : null}
            startContent={
              node.type === "folder" ? <FolderIcon /> : <FileImageIcon />
            }
          >
            {node.name}
          </ListboxItem>
        ))}
      </>
    );
  };

  return (
    <>
      {/* SIDE NAV DRAWER */}
      <Drawer
        isOpen={isSideNavOpen}
        onOpenChange={() => toggleSideNav()}
        placement="left"
        backdrop="transparent"
        radius="none"
        portalContainer={undefined}
        size="xs"
        isKeyboardDismissDisabled
      >
        <DrawerContent>
          {(onClose) => (
            <>
              <DrawerHeader className="flex flex-col gap-1">Folder Explorer</DrawerHeader>
              <DrawerBody>
                <Listbox
                  aria-label="Folders Menu"
                  className="p-0 gap-0 divide-y divide-default-300/50 dark:divide-default-100/80 bg-content1 max-w-[300px] overflow-visible shadow-small rounded-medium"
                  color="success"
                  itemClasses={{
                    base: "px-3 first:rounded-t-medium last:rounded-b-medium rounded-none gap-3 h-12 data-[hover=true]:bg-default-100/80",
                  }}
                  variant="flat"
                  onAction={handleAction}
                >
                  <ListboxItem
                    key={"ROOT"}
                    isReadOnly
                    showDivider
                    className="text-center h-auto"
                    endContent={
                      <Button
                        isIconOnly
                        size="lg"
                        variant="flat"
                        onPress={() => handleAction("ROOT")}
                      >
                        <HomeIcon />
                      </Button>
                    }
                    startContent={
                      <Button isIconOnly size="lg" variant="flat" onPress={handleBack}>
                        <ChevronLeft />
                      </Button>
                    }
                  >
                    {pathHistory[pathHistory.length - 1] || "ROOT"}
                  </ListboxItem>

                  {renderNodes()}

                  <ListboxItem key="CreateFolder" className="text-center h-auto">
                    Create folder
                    <PlusCircleIcon className="inline mb-1 ml-1" size={17} />
                  </ListboxItem>
                </Listbox>
              </DrawerBody>
            </>
          )}
        </DrawerContent>
      </Drawer >

      <Modal backdrop={"transparent"} isOpen={isOpen} onClose={onClose}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                Create folder
              </ModalHeader>
              <ModalBody>
                <Input
                  label="Enter folder name"
                  type="text"
                  value={newFolderName}
                  variant="bordered"
                  onChange={(event) => setNewFolderName(event.target.value)}
                />
              </ModalBody>
              <ModalFooter>
                <Button color="danger" variant="light" onPress={onClose}>
                  Close
                </Button>
                <Button
                  color="primary"
                  onPress={() => onCreateFolder(newFolderName)}
                >
                  Save
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
