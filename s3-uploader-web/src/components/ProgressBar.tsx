import React from 'react';
import { Progress } from '@radix-ui/themes';

interface ProgressBarProps {
  value: number; // Progress value from 0 to 100
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ value }) => {
  return (
    <Progress value={value} size="2" />
  );
};
