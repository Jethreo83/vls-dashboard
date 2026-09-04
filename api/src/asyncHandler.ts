// asyncHandler.ts — Express 4 does not route async rejections to error
// middleware automatically. Every async route handler in this app must be
// wrapped with this, or a thrown DB error crashes the whole process
// (proven live: a missing GRANT on vls.overdue_tasks took down the entire
// API, not just that one request, until this wrapper was added).
import { Request, Response, NextFunction, RequestHandler } from 'express';

export function ah(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
