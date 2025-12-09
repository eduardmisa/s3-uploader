import { Button } from "@heroui/button";
import { Card, CardFooter } from "@heroui/card";
import { Image } from "@heroui/image";
import { Tooltip } from "@heroui/tooltip";
import { VirtuosoMasonry } from "@virtuoso.dev/masonry";
import React, { useCallback, useMemo, useState } from "react";
import { Modal, ModalContent, ModalBody, useDisclosure } from "@heroui/modal";
import { Select, SelectItem } from "@heroui/select";

import DefaultLayout from "@/layouts/default";
import { title } from "@/components/primitives";
import { useSideNavBar } from "@/hooks/useSideNav";
import { Carousel } from "@/components/Carousel";
import { getThumbnailUrl } from "@/utils/urlUtil";

type FileType = "All" | "Pictures" | "Videos" | "Others";

const getFileType = (filename: string): FileType => {
  const imageExtensions = ["jpg", "jpeg", "png", "gif", "bmp", "webp", "tiff"];
  const videoExtensions = ["mp4", "mov", "avi", "mkv", "webm"];
  const extension = filename.split(".").pop()?.toLowerCase();

  if (!extension) return "Others";

  if (imageExtensions.includes(extension)) {
    return "Pictures";
  }
  if (videoExtensions.includes(extension)) {
    return "Videos";
  }

  return "Others";
};

export default function IndexPage() {
  const { isOpen, onOpen, onClose } = useDisclosure();

  const { currentFolderImages, pathHistory } = useSideNavBar();

  const [selectedImageUrl, setSelectedImageUrl] = useState("");
  const onImageClick = (url: string) => {
    setSelectedImageUrl(url);
    onOpen();
  };

  const [filterType, setFilterType] = useState<FileType>("All");

  const filteredItems = useMemo(() => {
    if (filterType === "All") {
      return currentFolderImages || [];
    }

    return (
      currentFolderImages?.filter((url) => {
        const filename = url.split("/").pop() || "";

        return getFileType(filename) === filterType;
      }) || []
    );
  }, [currentFolderImages, filterType]);

  const items = useMemo(() => filteredItems, [filteredItems]);

  const CardImage: React.FC<{ data: string }> = useCallback(
    ({ data }) => {
      if (!data) return <></>;

      const url = data;
      const name = url.split("/").pop() || "Unknown";

      return (
        <Card
          isFooterBlurred
          className="border-none radius-lg transition-transform duration-200 hover:scale-105 mx-auto! my-3 w-[150px] h-[150px]"
        >
          <Image
            alt={`S3 Image ${name}`}
            className="object-cover"
            height={150}
            isZoomed={true}
            src={getThumbnailUrl(url) || ""}
            width={150}
            onClick={() => onImageClick(url)}
          />
          <CardFooter className="justify-between before:bg-white/10 border-white/20 border-1 overflow-hidden py-1 absolute before:rounded-xl rounded-large bottom-1 w-[calc(100%_-_8px)] shadow-small ml-1 z-10">
            <Tooltip content={name} showArrow={true}>
              <Button
                fullWidth
                className="text-tiny text-white bg-black/20"
                color="default"
                radius="lg"
                size="sm"
                variant="light"
                onPress={() => onImageClick(url)}
              >
                {name}
              </Button>
            </Tooltip>
          </CardFooter>
        </Card>
      );
    },
    [isOpen],
  );

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [columnCount, setColumnCount] = React.useState<number>(1);

  React.useLayoutEffect(() => {
    const el = containerRef.current;

    if (!el) return;
    const itemWidth = 162; // approximate card width (200px) + gaps/margins
    const update = (width: number) => {
      const cols = Math.max(1, Math.floor(width / itemWidth));

      setColumnCount(cols);
    };

    // initial measurement
    update(el.clientWidth);
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        update(entry.contentRect.width);
      }
    });

    ro.observe(el);

    return () => ro.disconnect();
  }, []);

  return (
    <DefaultLayout>
      <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
        <div className="inline-block max-w-xl text-center justify-center">
          <span className={title()}>Here are your files in&nbsp;</span>
          <span className={title({ color: "violet" })}>
            {pathHistory[pathHistory.length - 1] || "All"}&nbsp;
          </span>
          <br />
          <span className={title()}>
            folder. ({currentFolderImages?.length || 0})
          </span>
        </div>
        <div className="flex w-full flex-col items-end">
          <Select
            className="max-w-xs mx-auto"
            label="Filter by type"
            selectedKeys={[filterType]}
            onSelectionChange={(keys) => {
              setFilterType(Array.from(keys)[0] as FileType);
            }}
          >
            <SelectItem key="All">All</SelectItem>
            <SelectItem key="Pictures">Pictures</SelectItem>
            <SelectItem key="Videos">Videos</SelectItem>
            <SelectItem key="Others">Others</SelectItem>
          </Select>
        </div>
      </section>
      <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
        <div
          ref={containerRef}
          className="flex flex-wrap gap-4 justify-center w-full"
        >
          <VirtuosoMasonry
            useWindowScroll
            ItemContent={CardImage}
            className="w-full!"
            columnCount={columnCount}
            data={items}
            initialItemCount={20}
          />
        </div>
      </section>

      <Modal
        backdrop={"transparent"}
        isOpen={isOpen}
        size="full"
        onClose={onClose}
      >
        <ModalContent className="flex w-full items-center justify-center">
          {() => (
            <>
              <ModalBody className="flex w-full">
                <Carousel selectedUrl={selectedImageUrl} urls={items} />
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>
    </DefaultLayout>
  );
}
