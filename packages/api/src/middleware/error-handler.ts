import type { ErrorHandler } from "hono";
import { BeaconError } from "@beacon-os/common";

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof BeaconError) {
    return c.json(
      {
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
        },
      },
      err.statusCode as 400,
    );
  }

  console.error("Unhandled error:", err);

  return c.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      },
    },
    500,
  );
};
