import React from 'react';
import { Flex, Button, Text } from '@radix-ui/themes';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange }) => {
  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  return (
    <Flex justify="center" align="center" gap="2" mt="3">
      <Button variant="outline" size="1" onClick={handlePrevious} disabled={currentPage === 1}>
        Previous
      </Button>
      <Text size="2">
        Page {currentPage} of {totalPages}
      </Text>
      <Button variant="outline" size="1" onClick={handleNext} disabled={currentPage === totalPages}>
        Next
      </Button>
    </Flex>
  );
};
