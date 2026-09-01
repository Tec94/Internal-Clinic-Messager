import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import Layout from "@/components/layout";
import { MINI_LOCALE_STORAGE_KEY } from "@/i18n";

describe("Mini App navigation and local actions", () => {
  it("moves through bottom navigation and the More sheet", async () => {
    const user = userEvent.setup();
    render(<Layout />);

    expect(
      await screen.findByRole("heading", { name: "Xin chào, Phạm Ngọc Linh", level: 1 }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: /Trò chuyện/ }));
    expect(await screen.findByRole("heading", { name: "Kênh", level: 1 })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Thêm" }));
    const dialog = await screen.findByRole("dialog", { name: "Thêm" });
    expect(dialog).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: /Tài liệu/ }));
    expect(
      await screen.findByRole("heading", { name: "Tài liệu dùng chung", level: 1 }),
    ).toBeInTheDocument();
  });

  it("navigates to task details and applies a local action", async () => {
    const user = userEvent.setup();
    render(<Layout />);

    await user.click(await screen.findByRole("link", { name: /^Công việc$/ }));
    await user.click(
      await screen.findByRole("link", { name: /Xác nhận thay đổi lịch bác sĩ Nguyễn/ }),
    );
    expect(
      await screen.findByRole("heading", {
        name: "Xác nhận thay đổi lịch bác sĩ Nguyễn",
        level: 1,
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Nhận việc" }));
    expect(await screen.findByText("Đã nhận")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Công việc đã được cập nhật.");
  });

  it("persists locale selection", async () => {
    const user = userEvent.setup();
    render(<Layout />);

    await user.click(
      await screen.findByRole("button", { name: "Chuyển sang tiếng Anh" }),
    );
    await waitFor(() => {
      expect(window.localStorage.getItem(MINI_LOCALE_STORAGE_KEY)).toBe("en-US");
    });
    expect(
      await screen.findByRole("heading", { name: "Hello, Phạm Ngọc Linh", level: 1 }),
    ).toBeInTheDocument();
  });
});
