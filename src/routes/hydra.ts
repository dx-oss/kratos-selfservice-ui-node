import {
  AdminApi as HydraAdminApi,
  Configuration as HydraConfiguration,
  AcceptConsentRequest,
  AcceptLoginRequest,
  RejectRequest,
  ConsentRequest
} from '@ory/hydra-client'
import { NextFunction, Request, Response, urlencoded } from 'express'

import {
  defaultConfig,
  requireAuth,
  RouteCreator,
  RouteRegistrator
} from '../pkg'

const isString = (x: any): x is string => typeof x === 'string'

const safeStringify = (v: any) => {
  const cache: any[] = []
  return JSON.stringify(
    v,
    (_key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (cache.includes(value)) return
        cache.push(value)
      }
      return value
    },
    4
  )
}

const config = {
  baseUrl: process.env.BASE_URL || '',
  hydra: {
    admin: (process.env.HYDRA_ADMIN_URL || '').replace(/\/+$/, '')
  },
  kratos: {
    browser: (process.env.KRATOS_BROWSER_URL || '').replace(/\/+$/, ''),
    admin: (process.env.KRATOS_ADMIN_URL || '').replace(/\/+$/, '')
    // public: publicUrl.replace(/\/+$/, ''),
  }
}

const hydraClient = new HydraAdminApi(
  new HydraConfiguration({ basePath: config.hydra.admin })
)

const redirectToLogin = (req: Request, res: Response, reason: string) => {
  // 3. Initiate login flow with ORY Kratos:
  //
  //   - `prompt=login` forces a new login from kratos regardless of browser sessions.
  //      This is important because we are letting Hydra handle sessions
  //   - `redirect_to` ensures that when we redirect back to this url,
  //      we will have both the initial ORY Hydra Login Challenge and the ORY Kratos Login Request ID in
  //      the URL query parameters.
  console.debug(reason)

  const returnTo = new URL(req.url, config.baseUrl)
  console.debug(`returnTo: "${returnTo.toString()}"`, returnTo)

  const redirectTo = new URL(
    config.kratos.browser + '/self-service/login/browser',
    config.baseUrl
  )
  redirectTo.searchParams.set('refresh', 'true')
  redirectTo.searchParams.set('return_to', returnTo.toString())

  console.debug(`redirectTo: "${redirectTo.toString()}"`, redirectTo)
  res.redirect(redirectTo.toString())
}

const createHydraLoginRoute: RouteCreator =
  (createHelpers) => (req: Request, res: Response, next: NextFunction) => {
    const { sdk } = createHelpers(req)
    // The hydraChallenge represents the Hydra login_challenge query parameter.
    const hydraChallenge = req.query.login_challenge
    if (!hydraChallenge || !isString(hydraChallenge))
      return next(
        new Error(
          'ORY Hydra Login flow could not be completed because no ORY Hydra Login Challenge was found in the HTTP request.'
        )
      )
    // 1. Parse Hydra hydraChallenge from query params
    // The hydraChallenge is used to fetch information about the login kratosRequest from ORY Hydra.
    // Means we have just been redirected from Hydra, and are on the login page
    // We must check the hydra session to see if we can skip login

    // 2. Call Hydra and check the session of this user
    return hydraClient
      .getLoginRequest(hydraChallenge)
      .then(({ data: body }) => {
        if (body.skip) {
          const acceptLoginRequest = {
            subject: String(body.subject)
          } as AcceptLoginRequest
          return hydraClient
            .acceptLoginRequest(hydraChallenge, acceptLoginRequest)
            .then(({ data: body }) => res.redirect(String(body.redirect_to)))
        }

        return sdk
          .toSession(undefined, req.header('Cookie'))
          .then(({ data: body }) => {
            const acceptLoginRequest: AcceptLoginRequest = {
              subject: body.identity.id,
              context: body,
              remember: true,
              remember_for: 36000
            } as AcceptLoginRequest
            return hydraClient
              .acceptLoginRequest(hydraChallenge, acceptLoginRequest)
              .then(({ data: body }) => res.redirect(String(body.redirect_to)))
          })
          .catch((e) => {
            return redirectToLogin(
              req,
              res,
              `Redirecting to login page because of previous error (${e})`
            )
          })
      })
      .catch(next)
  }

const hydraGetConsent = (req: Request, res: Response, next: NextFunction) => {
  // The challenge is used to fetch information about the consent request from ORY Hydra.
  const challenge: string =
    typeof req.query.consent_challenge === 'string'
      ? req.query.consent_challenge
      : ''
  if (!challenge)
    return next(new Error('Expected consent_challenge to be set.'))

  hydraClient
    .getConsentRequest(challenge)
    .then((r) => {
      // If a user has granted this application the requested scope, hydra will tell us to not show the UI.
      if (r.data.skip) {
        return AcceptConsent(challenge, r.data, req).then(({ data: body }) =>
          res.redirect(String(body.redirect_to))
        )
      }

      // If consent can't be skipped we MUST show the consent UI.
      res.render('consent', {
        challenge: challenge,
        // We have a bunch of data available from the response, check out the API docs to find what these values mean
        // and what additional data you have available.
        requested_scope: r.data.requested_scope,
        user: r.data.subject,
        client: r.data.client
      })
    })
    .catch(next)
}

const hydraPostConsent = (req: Request, res: Response, next: NextFunction) => {
  // The challenge is now a hidden input field, so let's take it from the request body instead
  const challenge = req.body.challenge

  // Let's see if the user decided to accept or reject the consent request..
  if (req.body.submit !== 'Allow access') {
    // Looks like the consent request was denied by the user
    return hydraClient
      .rejectConsentRequest(challenge, {
        error: 'access_denied',
        error_description: 'The resource owner denied the request'
      } as RejectRequest)
      .then(({ data: body }) => res.redirect(String(body.redirect_to)))
      .catch(next)
  }

  // Seems like the user authenticated! Let's tell hydra...
  hydraClient
    .getConsentRequest(challenge)
    .then((r) => AcceptConsent(challenge, r.data, req))
    .then(({ data: body }) => res.redirect(String(body.redirect_to)))
    .catch(next)
}

const AcceptConsent = (
  challenge: string,
  body: ConsentRequest,
  req: Request
) => {
  const acceptConsentRequest = {
    // ORY Hydra checks if requested audiences are allowed by the client, so we can simply echo this.
    grant_access_token_audience: body.requested_access_token_audience
  } as AcceptConsentRequest

  if (req.method === 'POST') {
    // This tells hydra to remember this consent request and allow the same client to request the same
    // scopes from the same user, without showing the UI, in the future.
    acceptConsentRequest.remember = Boolean(req.body.remember)

    // When this "remember" sesion expires, in seconds. Set this to 0 so it will never expire.
    acceptConsentRequest.remember_for = 0

    // allow the scopes that subject accepted in consent screen
    acceptConsentRequest.grant_scope = [].concat(req.body.grant_scope)
  } else if (req.method === 'GET') {
    // We can grant all scopes that have been requested - hydra already checked for us that no additional scopes
    // are requested accidentally.
    acceptConsentRequest.grant_scope = body.requested_scope
  } else {
    throw new Error('Unsupported request method....')
  }

  // The session allows us to set session data for id and access tokens. Let's add the email if it is included.
  acceptConsentRequest.session = {
    access_token: {
      'https://public-hydra.dx.dev/identity': {
        identity: req.session?.identity
      }
    },
    id_token: {
      'https://public-hydra.dx.dev/identity': {
        identity: req.session?.identity
      },
      'https://public-hydra.dx.dev/claims': {
        role: ['admin']
      }
    }
  }
  return hydraClient.acceptConsentRequest(challenge, acceptConsentRequest)
}

export const registerHydraRoutes: RouteRegistrator = (
  app,
  createHelpers = defaultConfig
) => {
  app.use(urlencoded())
  app.get('/hydra_login', createHydraLoginRoute(createHelpers))
  app.get('/hydra_consent', requireAuth(createHelpers), hydraGetConsent)
  app.post('/hydra_consent', requireAuth(createHelpers), hydraPostConsent)
}
