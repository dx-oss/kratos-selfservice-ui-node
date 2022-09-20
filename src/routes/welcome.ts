import { Request, Response } from "express"

import {
  defaultConfig,
  RouteCreator,
  RouteRegistrator,
  setSession,
} from "../pkg"

export const createWelcomeRoute: RouteCreator =
  (createHelpers) => async (req, res) => {
    res.locals.projectName = "Welcome to Ory"

    const { sdk } = createHelpers(req)
    const session = req.session

    // Create a logout URL
    const logoutUrl =
      (
        await sdk
          .createSelfServiceLogoutFlowUrlForBrowsers(req.header("cookie"))
          .catch(() => ({ data: { logout_url: "" } }))
      ).data.logout_url || ""
    const hasAddressToVerify = session?.identity?.verifiable_addresses?.some(
      (vfa) => !vfa.verified,
    )
    const isOverlord = (session?.identity?.metadata_public as any)?.overlord

    res.render("welcome", {
      hasSession: Boolean(session),
      logoutUrl,
      hasAddressToVerify,
      isOverlord,
      backofficeUrl: process.env.BACKOFFICE_URL,
      oryAdminUrl: process.env.ORY_ADMIN_URL,
    })
  }

export const registerWelcomeRoute: RouteRegistrator = (
  app,
  createHelpers = defaultConfig,
  route = "/welcome",
) => {
  app.get(route, setSession(createHelpers), createWelcomeRoute(createHelpers))
}
