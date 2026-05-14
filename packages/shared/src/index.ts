export type JobState = "pending" | "parsing" | "complete" | "failed";

export interface Job {
  id: string;
  state: JobState;
  originalFilename: string;
  extractedText: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CreateJobInput = Pick<Job, "originalFilename">;
export type UpdateJobInput = {
  state?: JobState;
  extractedText?: string;
  error?: string;
};
