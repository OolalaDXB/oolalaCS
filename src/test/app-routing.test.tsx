import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });
  it.each([
    ['/emirats', '/{-$lang}/emirats'],
    ['/georgie', '/{-$lang}/georgie/'],
    ['/france', '/{-$lang}/france'],
    ['/georgie/investir', '/{-$lang}/georgie/investir'],
    ['/contact', '/{-$lang}/contact'],
    ['/en', '/{-$lang}/'],
    ['/ru/emirats', '/{-$lang}/emirats'],
    ['/en/georgie/investir', '/{-$lang}/georgie/investir'],
    ['/ru/contact', '/{-$lang}/contact'],
    ['/rendez-vous', '/{-$lang}/rendez-vous/'],
    ['/en/rendez-vous/gerer', '/{-$lang}/rendez-vous/gerer'],
  ])('matches the requested Oolala page at %s', (path, routeId) => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    expect(router.matchRoutes(path).at(-1)?.routeId).toBe(routeId);
  });
});
