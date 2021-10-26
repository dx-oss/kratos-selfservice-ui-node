import { NextFunction, Request, Response } from 'express'

import { RouteRegistrator } from '../pkg'

export const register500Route: RouteRegistrator = (app) => {
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('Error:', err)
    res.status(500).render('error', {
      message: JSON.stringify(
        Object.getOwnPropertyNames(err).reduce((acc, key) => {
          acc[key] = (err as any)[key]
          return acc
        }, {} as any),
        null,
        2
      )
    })
  })
}
