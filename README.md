# Atlanta Tennis Connect

Build a modern, sporty, fully functional website for a tennis league platform based in Atlanta. This is a real product for real players and organizers, not a demo. Build every flow end to end so it actually works, using clean mock data that is structured like it will later connect to a real backend.

PLATFORM PURPOSE

The platform has two types of users: players and organizers.

Players come to discover tennis leagues and seasons, understand the format and skill level, check the schedule and fee, sign up, and pay.

Organizers come to create seasons, create leagues inside those seasons, set fees and schedules, open registration, and manage the players who sign up.

The whole experience should feel like a real sports platform that handles money and real commitments, so it needs to feel trustworthy as well as exciting.

BRAND AND VISUAL DIRECTION

Overall feel: modern, clean, minimalist, and sporty. Think of a premium sports brand, not a generic SaaS tool or an old fashioned league scheduling site.

Typography

Use a premium modern font pairing. Body text should use a clean grotesk font such as Inter, Manrope, or Satoshi. Headings can use a bolder, slightly more expressive display font for contrast and energy. Set a clear type scale with distinct sizes for hero headings, section headings, card titles, body text, and small labels. Do not use default system fonts like Arial or Times New Roman anywhere.

Color palette

Primary color: a deep green or navy, inspired by tennis courts, used for primary buttons, key headings, and navigation.

Accent color: tennis ball yellow or lime, used sparingly for highlights, active states, and calls to action, so it stands out.

Base colors: white or off white backgrounds, with a soft neutral gray for secondary text and borders.

Keep the palette tight. Avoid rainbow colors or unrelated brand colors.

Layout and spacing

Use generous white space and a clear visual hierarchy on every page. Use a consistent spacing scale, for example based on 4px or 8px increments, so padding and margins feel intentional rather than random. Use rounded corners and soft shadows for cards, kept subtle, not heavy or cartoonish.

Imagery and iconography

Use a consistent icon set throughout, ideally a modern line icon set. Where photos or illustrations are used, they should relate to tennis (courts, racquets, players in action) and should feel high quality, not stock photo cliche.

MOTION AND MICRO INTERACTIONS

Add tasteful, fast animations throughout, not just decoration:

Hero section: a subtle animated entrance, such as elements fading and sliding in on load.

Scroll animations: sections and cards fade and slide in as the user scrolls to them.

Hover states: buttons and cards should have a smooth hover animation, such as a slight lift, scale, or color shift.

Filters and tabs: switching between filters, tabs, or categories should animate smoothly rather than snapping instantly.

Page transitions: moving between pages should feel smooth, not like a hard reload.

Tennis themed detail: a small animated tennis ball accent, a subtle court line pattern in a background, or an animated racquet or ball icon used in a loading state. Keep these details tasteful and light, not childish or distracting.

All animations should be fast, ideally under 300 to 400 milliseconds, so the site feels quick, not slow or laggy.

INFORMATION ARCHITECTURE AND DATA MODEL

Structure the data model clearly, even with mock data, around three main entities:

Season: has a name, start date, end date, and status (upcoming, active, closed).

League: belongs to a season, has a format (junior singles, senior singles, junior doubles, senior doubles, mixed doubles), a skill level, a fee, a schedule, and a player limit.

Player: has profile details, and is linked to the leagues they are registered in.

This structure should be reflected in how data flows through the app, so it is easy to later connect to a real database.

CORE PAGES AND FLOWS

1. Home page

A strong hero section explaining what the platform is and who it is for, with a clear primary call to action to browse leagues. A section highlighting current or upcoming seasons. A simple three or four step section explaining how it works, for example: browse leagues, pick your level, sign up and pay, play your season. A closing call to action section encouraging signup.

2. Browse leagues page

A list or grid of current leagues and seasons. Filters for format, skill level, and season, that update the results smoothly without a full page reload. Each league card should show the league name, format, skill level, fee, and season dates, with a clear call to action to view details. Handle three states clearly:

Loading state, using skeleton cards rather than a blank screen.

Empty state, with a friendly message when no leagues match the selected filters.

Error state, with a clear message and a retry option if data fails to load.

3. League detail page

Full information about one league: format, age group, skill level, schedule, fee, and start date. A clear, prominent call to action to sign up. Optionally, a short section showing what a typical match day or season looks like.

4. Signup and registration flow

A clean registration form, either single step or a short multi step flow, collecting player details, selected league, and payment information. Real time field validation with clear, friendly error messages. A clear review or confirmation step before final submission. A confirmation screen after successful signup, showing what happens next.

5. Player dashboard

A simple, clear dashboard for a signed up player showing the leagues they are registered in, their schedule, and their current season status. Easy access to update their profile or view league details again.

6. Organizer dashboard

A separate, clearly distinct interface for organizers. Ability to create a new season with a name and dates. Ability to create one or more leagues inside a season, setting format, skill level, fee, schedule, and player limit. Ability to open or close registration for a league. A view of registered players for each league, with basic player details.

7. Login and role handling

A simple login flow that separates player accounts from organizer accounts, so each sees only the dashboard relevant to them.

FUNCTIONALITY REQUIREMENTS

Every flow described above should be genuinely functional, not just a visual mockup:

Forms should validate input and show clear error and success states.

Filters and search should genuinely filter the displayed data.

Navigation between pages should be smooth and consistent.

Mock data should be realistic and consistent across pages, for example a league shown on the browse page should match its own detail page exactly.

RESPONSIVENESS

Design mobile first, since many players are expected to sign up from their phones, then adapt cleanly up to tablet and desktop sizes. On desktop, layouts should feel intentional and well composed, not just a stretched mobile layout. All filters, forms, dashboards, and navigation must work smoothly and remain fully usable on small screens, including comfortable tap targets for buttons and form fields.

UI BEST PRACTICES

Consistent spacing, alignment, and sizing across every page. Consistent button styles, with clear primary and secondary button treatments. Consistent card design across leagues, seasons, and dashboard items. Clear, visible focus states for accessibility when navigating with a keyboard. Good color contrast between text and background at all times. Sticky or easily reachable main navigation. Clear back navigation or breadcrumbs on detail and form pages. Skeleton loaders instead of blank white screens while content loads, to keep the experience feeling fast.

TONE AND OVERALL EXPERIENCE

The platform should feel professional and trustworthy at every step involving money or personal information, while still feeling energetic, modern, and fun overall, closer to a sports brand experience than a plain administrative tool. A visitor should leave with the impression that this is a serious, well built platform they can confidently pay to join.

HERO BANNER SHOULD BE VISUALLY APPEALING NOT BASIC



## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

Local sign-in also requires the Express API and MongoDB. The command above
starts only the frontend. In a second terminal, from the repository root, run:

```sh
npm install --prefix backend
npm run dev:api
```

The API reads `backend/.env`; set `MONGODB_URI` there and keep `PORT=3001`
and `NODE_ENV=development` for local development. Wait for the API startup
message, then open the URL printed by Vite. Vite forwards `/api` requests to
`http://localhost:3001`. Check `http://localhost:3001/api/health` to confirm
the API has started. An `.env` file configures the API but does not start it.

Use an account created in the connected database. Mock league data can appear
even when the API is offline, so a working homepage does not confirm sign-in
is available.

### Production checks

Run `npm run build` before deploying. It runs TypeScript checks and the frontend
regression tests before creating production output, and stops if either fails.
Use this same build command in the deployment configuration so these checks are
not bypassed. Run `npm test` to check league browsing independently; the tests
cover player sign-in/session restoration, season selection, and missing season
data. They use local fixtures and do not require database credentials.

Authentication uses same-origin `/api` routes in production and the Vite proxy
locally. Remove obsolete production `VITE_API_URL` settings; the frontend no
longer uses them. Configure `MONGODB_URI` on the production Vercel project itself.
Login and signup require a server session; old browser-only accounts and saved
plaintext passwords are not accepted. Existing users must use their database
account password. Provision organizer accounts through an administrator, and
rotate any existing public demo credentials before a public release.

Run `npm test --prefix backend` to validate authentication and reservation
behavior against an isolated temporary MongoDB database. Its first run downloads
a MongoDB test binary. These tests do not modify the configured application database.
## Environment Setup
1. Copy the example environment files:
   ```bash
   cp .env.example .env
   cp backend/.env.example backend/.env
   ```
2. Populate the `.env` files with your actual local configuration values.
3. **NEVER commit `.env`** or any files containing credentials to version control.
