import type { NextFunction, Request, Response } from 'express';

const nocache = (req: Request, res: Response, next: NextFunction) => {
  // Comprehensive cache control headers to prevent back button access
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
    Pragma: 'no-cache',
    Expires: '0',
    'Surrogate-Control': 'no-store'
  });
  next();
};

export = nocache;
