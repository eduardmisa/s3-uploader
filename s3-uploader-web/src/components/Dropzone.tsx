import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card, Flex, Text } from '@radix-ui/themes';

interface DropzoneProps {
  onFilesDropped: (files: File[]) => void;
}

export const Dropzone: React.FC<DropzoneProps> = ({ onFilesDropped }) => {
  const [isDragActive, setIsDragActive] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setIsDragActive(false);
    onFilesDropped(acceptedFiles);
  }, [onFilesDropped]);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    onDragEnter: () => setIsDragActive(true),
    onDragLeave: () => setIsDragActive(false),
    noClick: false, // Allow clicking to open file dialog
  });

  return (
    <Card
      {...getRootProps()}
      variant="surface"
      style={{
        border: `2px dashed ${isDragActive ? 'var(--accent-9)' : 'var(--gray-7)'}`,
        padding: '60px', /* Even bigger padding */
        minHeight: '200px', /* Even bigger minimum height */
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'border-color 0.2s ease-in-out, transform 0.2s ease-in-out',
        transform: isDragActive ? 'scale(1.02)' : 'scale(1)',
      }}
    >
      <input {...getInputProps()} />
      <Flex direction="column" gap="2">
        <Text size="4" weight="bold">
          {isDragActive ? 'Drop the files here...' : 'Drag & drop files here, or click to select'}
        </Text>
        <Text size="2" color="gray">
          Supports multiple files
        </Text>
      </Flex>
    </Card>
  );
};
