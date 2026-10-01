import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import Layout from "@/components/layout";
import { getNavigationDirection } from "@/components/DirectionalLink";
import { MINI_LOCALE_STORAGE_KEY } from "@/i18n";

const currentPage = () => within(screen.getByRole("main").querySelector(".zaui-routes-item:last-child") as HTMLElement);

describe("Mini App navigation and local actions", () => {
  it("moves through bottom navigation and the More sheet", async () => {
    const user = userEvent.setup();
    render(<Layout />);

    expect(
      await screen.findByRole("heading", { name: "Xin chào, Linh", level: 1 }),
    ).toBeInTheDocument();

    await user.click(within(screen.getByRole("navigation", { name: "Điều hướng chính" })).getByRole("link", { name: /Trò chuyện/ }));
    expect(await screen.findByRole("heading", { name: "Kênh", level: 1 })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Thêm" }));
    const dialog = await screen.findByRole("dialog", { name: "Thêm" });
    expect(dialog).toBeInTheDocument();
    await user.click(within(dialog).getByRole("link", { name: /Tài liệu/ }));
    expect(
      await screen.findByRole("heading", { name: "Tài liệu dùng chung", level: 1 }),
    ).toBeInTheDocument();
  });

  it("navigates to task details and applies a local action", async () => {
    const user = userEvent.setup();
    render(<Layout />);

    await user.click(within(screen.getByRole("navigation", { name: "Điều hướng chính" })).getByRole("link", { name: /^Công việc$/ }));
    await user.click(
      await within(screen.getByRole("main")).findByRole("link", { name: /Xác nhận thay đổi lịch bác sĩ Nguyễn/ }),
    );
    expect(
      await screen.findByRole("heading", {
        name: "Xác nhận thay đổi lịch bác sĩ Nguyễn",
        level: 1,
      }),
    ).toBeInTheDocument();

    await waitFor(() => expect(screen.getByRole("main").querySelectorAll(".zaui-routes-item")).toHaveLength(1));

    await user.click(currentPage().getByRole("button", { name: "Nhận việc" }));
    expect(currentPage().getAllByText("Đã nhận").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("status").some((status) => status.textContent?.includes("Công việc đã được cập nhật."))).toBe(true);

    await user.click(within(screen.getByRole("navigation", { name: "Điều hướng chính" })).getByRole("link", { name: "Hộp thư" }));
    await screen.findByRole("heading", { name: "Xin chào, Linh", level: 1 });
    expect(screen.getByRole("heading", { name: "Hôm nay" })).toBeInTheDocument();
    expect(screen.queryByText("Bạn đã xem hết nội dung trong phạm vi hiện tại.")).not.toBeInTheDocument();
  });

  it("shows one caught-up summary and keeps quiet channels reachable through Chat", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "?fixture=empty");
    try {
      render(<Layout />);
      expect(await screen.findByRole("status")).toHaveTextContent(
        "Bạn đã xem hết nội dung trong phạm vi hiện tại.",
      );
      expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /Lễ tân — công việc chung/ })).not.toBeInTheDocument();

      await user.click(within(screen.getByRole("navigation", { name: "Điều hướng chính" })).getByRole("link", { name: "Trò chuyện" }));
      expect(await within(screen.getByRole("main")).findByRole("link", { name: /Lễ tân — công việc chung/ })).toBeInTheDocument();
    } finally {
      window.history.replaceState(null, "", "/");
    }
  });

  it("keeps a declined meeting in today and lets the response change", async () => {
    const user = userEvent.setup();
    render(<Layout />);
    await user.click(within(screen.getByRole("navigation", { name: "Điều hướng chính" })).getByRole("link", { name: "Cuộc họp" }));
    const main = screen.getByRole("main");
    expect(await within(main).findByRole("heading", { name: "Hôm nay" })).toBeInTheDocument();
    const today = () => within(currentPage().getByRole("heading", { name: "Hôm nay" }).closest("section") as HTMLElement);
    await user.click(today().getByRole("button", { name: "Từ chối" }));
    expect(today().getByRole("button", { name: "Từ chối" })).toHaveAttribute("aria-pressed", "true");
    await user.click(today().getByRole("button", { name: "Nhận lời" }));
    expect(today().getByRole("button", { name: "Nhận lời" })).toHaveAttribute("aria-pressed", "true");
  });

  it("persists locale selection", async () => {
    const user = userEvent.setup();
    render(<Layout />);

    expect(screen.queryByRole("button", { name: "Chuyển sang tiếng Anh" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Thêm" }));
    await user.click(within(await screen.findByRole("dialog", { name: "Thêm" })).getByRole("link", { name: /Cài đặt/ }));
    await user.click(
      await screen.findByRole("button", { name: "Chuyển sang tiếng Anh" }),
    );
    await waitFor(() => {
      expect(window.localStorage.getItem(MINI_LOCALE_STORAGE_KEY)).toBe("en-US");
    });
    expect(
      await screen.findByRole("heading", { name: "Hello, Linh", level: 1 }),
    ).toBeInTheDocument();
  });

  it("derives transition direction from page order and detail depth", () => {
    expect(getNavigationDirection("/", "/tasks")).toBe("forward");
    expect(getNavigationDirection("/meetings", "/chat")).toBe("backward");
    expect(getNavigationDirection("/tasks", "/tasks/task-1")).toBe("forward");
    expect(getNavigationDirection("/tasks/task-1", "/tasks")).toBe("backward");
    expect(getNavigationDirection("/documents", "/settings")).toBe("forward");
  });
});
