import { forwardRef, MouseEvent, useCallback } from "react";
import {
  createPath,
  Link,
  LinkProps,
  NavLink,
  NavLinkProps,
  resolvePath,
  useLocation,
} from "react-router-dom";
import { useNavigate } from "zmp-ui";

const pageOrder = [
  "/",
  "/chat",
  "/tasks",
  "/meetings",
  "/documents",
  "/people",
  "/settings",
] as const;

type NavigationDirection = "forward" | "backward";

const getPagePosition = (pathname: string): [page: number, depth: number] => {
  const segments = pathname.split("/").filter(Boolean);
  const section = segments.length ? `/${segments[0]}` : "/";
  const sectionIndex = pageOrder.indexOf(section as (typeof pageOrder)[number]);

  return [sectionIndex === -1 ? pageOrder.length : sectionIndex, Math.max(0, segments.length - 1)];
};

export const getNavigationDirection = (
  currentPathname: string,
  destinationPathname: string,
): NavigationDirection => {
  const [currentPage, currentDepth] = getPagePosition(currentPathname);
  const [destinationPage, destinationDepth] = getPagePosition(destinationPathname);

  if (destinationPage !== currentPage) {
    return destinationPage < currentPage ? "backward" : "forward";
  }

  return destinationDepth < currentDepth ? "backward" : "forward";
};

type DirectionalLinkOptions = Pick<
  LinkProps,
  | "to"
  | "onClick"
  | "target"
  | "reloadDocument"
  | "replace"
  | "state"
  | "preventScrollReset"
  | "relative"
  | "viewTransition"
>;

const useDirectionalClick = ({
  to,
  onClick,
  target,
  reloadDocument,
  replace,
  state,
  preventScrollReset,
  relative,
  viewTransition,
}: DirectionalLinkOptions) => {
  const location = useLocation();
  const navigate = useNavigate();

  return useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event);

      const isModifiedClick = event.metaKey || event.altKey || event.ctrlKey || event.shiftKey;
      const isExternal =
        typeof to === "string" && /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(to);
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        isModifiedClick ||
        (target && target !== "_self") ||
        reloadDocument ||
        isExternal
      ) {
        return;
      }

      event.preventDefault();
      const destination = resolvePath(to, location.pathname);
      const currentLocation = `${location.pathname}${location.search}${location.hash}`;

      if (createPath(destination) === currentLocation) return;

      navigate(to, {
        direction: getNavigationDirection(location.pathname, destination.pathname),
        preventScrollReset,
        relative,
        replace,
        state,
        viewTransition,
      });
    },
    [
      location.hash,
      location.pathname,
      location.search,
      navigate,
      onClick,
      preventScrollReset,
      relative,
      reloadDocument,
      replace,
      state,
      target,
      to,
      viewTransition,
    ],
  );
};

export const DirectionalLink = forwardRef<HTMLAnchorElement, LinkProps>((props, ref) => {
  const handleClick = useDirectionalClick(props);
  return <Link {...props} ref={ref} onClick={handleClick} />;
});

DirectionalLink.displayName = "DirectionalLink";

export const DirectionalNavLink = forwardRef<HTMLAnchorElement, NavLinkProps>((props, ref) => {
  const handleClick = useDirectionalClick(props);
  return <NavLink {...props} ref={ref} onClick={handleClick} />;
});

DirectionalNavLink.displayName = "DirectionalNavLink";
