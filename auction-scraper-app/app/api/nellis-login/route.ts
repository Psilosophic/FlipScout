import { NextRequest, NextResponse } from "next/server";

// ─── POST /api/nellis-login ───────────────────────────────────────────────────
// Logs into nellisauction.com using Playwright, extracts the session cookies,
// and stores them in an HTTP-only cookie on the FlipScout domain.
// The cookies are then forwarded with every scrape request so that "Bid Now"
// links open the user's authenticated session.
//
// Security note: credentials are never stored — they are used once to obtain
// session cookies, then discarded. Cookies are stored HTTP-only and SameSite=Strict.
export async function POST(request: NextRequest) {
  let email: string, password: string;
  try {
    ({ email, password } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  let chromium: any, playwright: any;
  try {
    // @ts-ignore — optional dependency, may not be installed
    chromium = (await import("@sparticuz/chromium")).default;
    // @ts-ignore — optional dependency, may not be installed
    playwright = await import("playwright-core");
  } catch {
    return NextResponse.json(
      { error: "Playwright not available in this environment. Deploy to Vercel with the playwright layer to enable this feature." },
      { status: 503 }
    );
  }

  let browser: any;
  try {
    const executablePath = await chromium.executablePath();
    browser = await playwright.chromium.launch({
      args: chromium.args,
      executablePath,
      headless: true,
    });

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 900 },
    });

    const page = await context.newPage();

    // Navigate to the Nellis login page
    await page.goto("https://www.nellisauction.com/login", {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    // Fill email field — Nellis uses standard <input type="email"> and <input type="password">
    await page.fill('input[type="email"], input[name="email"], input[id*="email"]', email);
    await page.fill('input[type="password"], input[name="password"], input[id*="password"]', password);

    // Submit — click Sign In button
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle", timeout: 20000 }),
      page.click('button[type="submit"], button:has-text("Sign In"), button:has-text("Log In"), input[type="submit"]'),
    ]);

    // Check for login failure indicators
    const errorEl = await page.$('[class*="error"], [class*="Error"], [role="alert"]');
    if (errorEl) {
      const errorText = (await errorEl.textContent()) ?? "";
      if (
        errorText.toLowerCase().includes("invalid") ||
        errorText.toLowerCase().includes("incorrect") ||
        errorText.toLowerCase().includes("wrong")
      ) {
        await browser.close();
        return NextResponse.json(
          { error: "Invalid email or password. Please check your Nellis credentials." },
          { status: 401 }
        );
      }
    }

    // Verify we're logged in by checking for account-related elements
    const isLoggedIn = await page.evaluate(() => {
      const html = document.documentElement.innerHTML;
      return (
        html.includes("my-account") ||
        html.includes("myaccount") ||
        html.includes("sign-out") ||
        html.includes("signout") ||
        html.includes("logout") ||
        html.includes("log-out") ||
        html.includes("account/profile") ||
        html.includes("Welcome")
      );
    });

    if (!isLoggedIn) {
      await browser.close();
      return NextResponse.json(
        { error: "Login appeared to succeed but session could not be confirmed. Check your credentials." },
        { status: 401 }
      );
    }

    // Extract all cookies from the authenticated session
    const cookies = await context.cookies("https://www.nellisauction.com");

    // Only keep cookies relevant to authentication (session tokens, JWT, etc.)
    const authCookies = cookies.filter((c: any) =>
      c.name.toLowerCase().includes("session") ||
      c.name.toLowerCase().includes("token") ||
      c.name.toLowerCase().includes("auth") ||
      c.name.toLowerCase().includes("user") ||
      c.name.toLowerCase().includes("jwt") ||
      c.name.toLowerCase().includes("sid") ||
      c.name.toLowerCase().includes("access") ||
      c.name.toLowerCase().includes("id") ||
      c.name.toLowerCase().includes("nellis") ||
      c.name.startsWith("_")
    );

    await browser.close();

    // Serialize cookies to store in our own HTTP-only cookie
    const cookiePayload = JSON.stringify(
      authCookies.map((c: any) => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
      }))
    );

    // Get the display name from the page if possible
    const displayName = email.split("@")[0];

    const response = NextResponse.json({
      success: true,
      message: `Logged in as ${email}`,
      displayName,
      cookieCount: authCookies.length,
    });

    // Store auth cookies HTTP-only so JS can't read them — forwarded by /api/scrape-live
    response.cookies.set("nellis_auth_cookies", cookiePayload, {
      httpOnly: true,
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    // Store a readable session indicator (non-sensitive) for the UI
    response.cookies.set("nellis_session_user", displayName, {
      httpOnly: false,
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (e: any) {
    if (browser) {
      try { await browser.close(); } catch {}
    }
    console.error("[FlipScout][Login]", e?.message);
    return NextResponse.json(
      { error: `Login failed: ${e?.message ?? "Unknown error"}` },
      { status: 500 }
    );
  }
}

// ─── DELETE /api/nellis-login ─────────────────────────────────────────────────
// Logs out — clears the stored session cookies.
export async function DELETE() {
  const response = NextResponse.json({ success: true, message: "Logged out" });
  response.cookies.delete("nellis_auth_cookies");
  response.cookies.delete("nellis_session_user");
  return response;
}

// ─── GET /api/nellis-login ────────────────────────────────────────────────────
// Returns current session status (no credentials exposed).
export async function GET(request: NextRequest) {
  const sessionUser = request.cookies.get("nellis_session_user")?.value;
  const hasAuthCookies = !!request.cookies.get("nellis_auth_cookies")?.value;

  return NextResponse.json({
    loggedIn: hasAuthCookies && !!sessionUser,
    displayName: sessionUser ?? null,
  });
}
