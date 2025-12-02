import { Button } from "@heroui/button";
import { Image } from "@heroui/image";
import { Listbox, ListboxItem } from "@heroui/listbox";
import { useQuery } from "@tanstack/react-query";
import { CheckCircleIcon, CircleAlertIcon, ImageIcon } from "lucide-react";
import { useCallback } from "react";

import { ListFilesResult, listFilesFromS3 } from "@/lib/aws-s3";
import DefaultLayout from "@/layouts/default";
import { useProcessImageThumbnailMutation } from "@/hooks/useProcessImageThumbnailMutation";
import { useDeleteAllThumbnailsMutation } from "@/hooks/useDeleteAllThumbnailsMutation";
import { getThumbnailUrl } from "@/utils/urlUtil";

export default function ThumbnailPage() {
  const imageThumbnailExists = (url: string) => {
    try {
      const targetThumbnailUrl = getThumbnailUrl(url) || "";

      const exists = s3FileData?.imageThumbnailsUrls.find((url) =>
        url.includes(targetThumbnailUrl),
      );

      return exists!!;
    } catch {
      return false;
    }
  };

  const { data: s3FileData } = useQuery<ListFilesResult>({
    queryKey: ["s3Files"],
    queryFn: () => listFilesFromS3(),
  });
  const noThumbnails = s3FileData?.fileUrls.filter(
    (url) => !imageThumbnailExists(url),
  );

  const processMutation = useProcessImageThumbnailMutation();
  const deleteMutation = useDeleteAllThumbnailsMutation();

  const processThumbnails = async () => {
    const urls = noThumbnails;

    if (!urls?.length) return;

    const batchSize = 10;

    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);

      try {
        await processMutation.mutateAsync({ urls: batch });
      } catch {
        // continue with next batch
      }
    }
  };

  const handleDeleteAllThumbnails = async () => {
    if (
      window.confirm(
        "Are you sure you want to delete all thumbnails? This action cannot be undone.",
      )
    ) {
      await deleteMutation.mutateAsync();
    }
  };

  const renderList = useCallback(() => {
    if (!s3FileData || !s3FileData?.fileUrls) return <></>;

    return (
      <>
        <Listbox
          aria-label="Folders Menu"
          className="p-0 gap-0 divide-y divide-default-300/50 dark:divide-default-100/80 bg-content1 overflow-visible shadow-small rounded-medium"
          color="success"
          itemClasses={{
            base: "px-3 first:rounded-t-medium last:rounded-b-medium rounded-none gap-3 h-12 data-[hover=true]:bg-default-100/80",
          }}
          variant="flat"
        >
          {s3FileData?.fileUrls.map((url) => (
            <ListboxItem
              key={url}
              endContent={
                <>
                  {imageThumbnailExists(url) ? (
                    <>
                      <Image
                        className="w-[20px] h-[20px] rounded-sm"
                        src={getThumbnailUrl(url) || ""}
                      />
                      <CheckCircleIcon className="text-success" />
                    </>
                  ) : (
                    <>
                      <Image className="w-[20px] h-[20px]" src={""} />
                      <CircleAlertIcon className="text-warning" />
                    </>
                  )}
                </>
              }
              startContent={<ImageIcon />}
            >
              {url}
            </ListboxItem>
          ))}
        </Listbox>
      </>
    );
  }, [s3FileData?.fileUrls]);

  const canProcessThumbnails = (noThumbnails?.length || 0) > 0;

  return (
    <DefaultLayout>
      <div className="flex gap-2 mb-5">
        <Button
          color={canProcessThumbnails ? "success" : "default"}
          isDisabled={!canProcessThumbnails}
          isLoading={processMutation.isPending}
          variant="shadow"
          onPress={processThumbnails}
        >
          Process Thumbnails ({noThumbnails?.length})
        </Button>
        <Button
          color="danger"
          isDisabled={deleteMutation.isPending}
          isLoading={deleteMutation.isPending}
          variant="shadow"
          onPress={handleDeleteAllThumbnails}
        >
          Delete All Thumbnails
        </Button>
      </div>

      <div className="flex gap-5">{renderList()}</div>
    </DefaultLayout>
  );
}
