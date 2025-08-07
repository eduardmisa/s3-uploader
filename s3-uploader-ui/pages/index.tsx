import { title } from "@/components/primitives";
import DefaultLayout from "@/layouts/default";
import { listFilesFromS3, ListFilesResult } from "@/lib/aws-s3";
import { Button } from "@heroui/button";
import { Card, CardFooter } from "@heroui/card";
import { Image } from "@heroui/image";
import { Tooltip } from "@heroui/tooltip";
import { useQuery } from "@tanstack/react-query";

export default function IndexPage() {
  const { data: s3FileData } = useQuery<ListFilesResult>({
    queryKey: ['s3Files'],
    queryFn: () => listFilesFromS3()
  });

  return (
    <DefaultLayout>
      <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
        <div className="inline-block max-w-xl text-center justify-center">
          <span className={title()}>Here are your recently&nbsp;</span>
          <span className={title({ color: "violet" })}>uploaded&nbsp;</span>
          <br />
          <span className={title()}>
            files.
          </span>
        </div>
      </section>
      <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
        <div className="flex flex-wrap gap-4 justify-center">
          {s3FileData?.fileUrls.map((url, index) => {
            const name = url.split('/').pop() || 'Unknown'
            return (
              <Card
                isFooterBlurred
                className="border-none radius-lg transition-transform duration-200 hover:scale-105"
                key={`${index}-${name}`}
                style={{ width: "200px" }}
              >
                <Image
                  alt={`S3 Image ${name}`}
                  className="object-cover"
                  height={200}
                  src={url}
                />
                <CardFooter className="justify-between before:bg-white/10 border-white/20 border-1 overflow-hidden py-1 absolute before:rounded-xl rounded-large bottom-1 w-[calc(100%_-_8px)] shadow-small ml-1 z-10">
                  <Tooltip content={name} showArrow={true}>
                    <Button
                      className="text-tiny text-white bg-black/20"
                      color="default"
                      radius="lg"
                      size="sm"
                      variant="light"
                      fullWidth
                    >
                      {name}
                    </Button>
                  </Tooltip>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      </section>
    </DefaultLayout>
  );
}
