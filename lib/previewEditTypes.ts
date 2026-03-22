export type PreviewEditTarget = {
  criterion: string;
  level: string;
  feedback: string;
  actionPlan: string;
};

export type PreviewEditRequestBody = {
  imageDataUrl: string;
  style: string;
  medium: string;
  target: PreviewEditTarget;
};

export type PreviewEditResponseBody = {
  imageDataUrl: string;
  criterion: string;
};
