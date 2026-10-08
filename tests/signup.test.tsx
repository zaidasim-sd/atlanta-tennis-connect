import type { ComponentType, ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Route } from "@/routes/signup";

const { navigate, refreshSession } = vi.hoisted(() => ({ navigate: vi.fn(), refreshSession: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options, useSearch: () => ({}) }),
  useNavigate: () => navigate,
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));
vi.mock("@/lib/store", () => ({
  getApiUrl: (path: string) => path,
  useStore: () => ({ refreshSession, leagueById: () => undefined }),
}));
vi.mock("@/components/modern-dob-picker", () => ({
  ModernDobPicker: ({ value, onChange }: { value: string; onChange: (value: string) => void }) =>
    <input id="dob-trigger" type="date" value={value} onChange={(event) => onChange(event.target.value)} />,
}));

const Signup = Route.options.component as ComponentType;
const fetchMock = vi.fn();
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  refreshSession.mockResolvedValue({ id: "account" });
});
afterEach(() => { vi.unstubAllGlobals(); });

function fillSignup() {
  render(<Signup />);
  for (const [label, value] of [
    [/First name/i, "Test"], [/Last name/i, "Player"], [/Email address/i, "test@example.com"],
    [/Confirm password/i, "test-password"],
  ] as const) fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.change(screen.getByLabelText(/Password/i, { selector: "#password" }), { target: { value: "test-password" } });
  fireEvent.change(screen.getByLabelText(/ZIP Code/i), { target: { value: "30309" } });
  fireEvent.click(screen.getByRole("button", { name: "3.5", exact: true }));
}

function submitSignup() {
  fillSignup();
  fireEvent.submit(screen.getByRole("button", { name: "Create Account" }).closest("form")!);
}

it("starts with blank player information and no extra signup fields", () => {
  render(<Signup />);
  expect((screen.getByLabelText(/ZIP Code/i) as HTMLInputElement).value).toBe("");
  expect((screen.getByLabelText(/Email address/i) as HTMLInputElement).value).toBe("");
  expect(screen.getByRole("button", { name: "3.5", exact: true }).getAttribute("aria-pressed")).toBe("false");
  expect(screen.queryByLabelText(/Phone Number/i)).toBeNull();
  expect(screen.queryByLabelText(/City/i)).toBeNull();
  expect(screen.queryByLabelText(/Home Court/i)).toBeNull();
  expect(screen.queryByLabelText(/Guardian Name/i)).toBeNull();
});

it("requests guardian details for juniors and validates the phone number", async () => {
  fillSignup();
  fireEvent.change(screen.getByLabelText(/Date of Birth/i), { target: { value: "2013-06-06" } });
  fireEvent.change(screen.getByLabelText(/Guardian Name/i), { target: { value: "Test Guardian" } });
  fireEvent.change(screen.getByLabelText(/Guardian Phone/i), { target: { value: "123" } });
  fireEvent.submit(screen.getByRole("button", { name: "Create Account" }).closest("form")!);
  expect(screen.getByText(/valid parent or guardian phone number/i)).toBeTruthy();
  expect(fetchMock).not.toHaveBeenCalled();
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 201 }));
  fireEvent.change(screen.getByLabelText(/Guardian Phone/i), { target: { value: "(404) 555-0199" } });
  fireEvent.submit(screen.getByRole("button", { name: "Create Account" }).closest("form")!);
  await waitFor(() => expect(refreshSession).toHaveBeenCalled());
  const body = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(body).toMatchObject({ dateOfBirth: "2013-06-06", parentName: "Test Guardian", parentPhone: "(404) 555-0199", isJunior: true });
  expect(body).not.toHaveProperty("city");
  expect(body).not.toHaveProperty("phone");
  expect(body).not.toHaveProperty("preferredCourt");
});

it("does not create a browser account or navigate when the server rejects signup", async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: false, error: "Signup unavailable" }), { status: 500 }));
  submitSignup();
  await screen.findByText("Signup unavailable");
  expect(refreshSession).not.toHaveBeenCalled();
  expect(navigate).not.toHaveBeenCalled();
  expect(localStorage.getItem("atl-registered-accounts")).toBeNull();
});

it("only navigates after server signup and session verification, without storing the password", async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 201 }));
  submitSignup();
  await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/dashboard" }));
  expect(refreshSession).toHaveBeenCalledOnce();
  expect(localStorage.getItem("atl-registered-accounts")).toBeNull();
});
