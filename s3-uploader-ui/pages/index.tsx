import { Button } from "@heroui/button";
import { Card, CardFooter } from "@heroui/card";
import { Image } from "@heroui/image";
import { Tooltip } from "@heroui/tooltip";
import { useQuery } from "@tanstack/react-query";

import { listFilesFromS3, ListFilesResult } from "@/lib/aws-s3";
import DefaultLayout from "@/layouts/default";
import { title } from "@/components/primitives";
import { VirtuosoMasonry } from '@virtuoso.dev/masonry'
import React, { useRef } from "react";

export default function IndexPage() {
  const { data: s3FileData } = useQuery<ListFilesResult>({
    queryKey: ["s3Files"],
    queryFn: () => listFilesFromS3(),
  });

  const data = s3FileData?.fileUrls || [];

  const CardImage: React.FC<{ context: unknown; data: string; index: number; }> = ({ data }) => {
    if (!s3FileData || s3FileData.fileUrls.length <= 0)
      return <></>

    const url = data;
    const name = url.split("/").pop() || "Unknown";

    return (
      <Card
        isFooterBlurred
        className="border-none radius-lg transition-transform duration-200 hover:scale-105 m-5"
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
              fullWidth
              className="text-tiny text-white bg-black/20"
              color="default"
              radius="lg"
              size="sm"
              variant="light"
              onPress={() => window.open(url, "_blank")}
            >
              {name}
            </Button>
          </Tooltip>
        </CardFooter>
      </Card>
    );
  }

  return (
    <DefaultLayout>
      <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
        <div className="inline-block max-w-xl text-center justify-center">
          <span className={title()}>Here are your recently&nbsp;</span>
          <span className={title({ color: "violet" })}>uploaded&nbsp;</span>
          <br />
          <span className={title()}>files.</span>
        </div>
      </section>
      <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
        <div className="flex flex-wrap gap-4 justify-center w-full">
          <VirtuosoMasonry
            useWindowScroll
            columnCount={5}
            initialItemCount={20}
            data={data}
            ItemContent={CardImage}
            className="w-full!"
          />
        </div>
      </section>
    </DefaultLayout>
  );
}
