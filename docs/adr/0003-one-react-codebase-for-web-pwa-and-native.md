# One React codebase for web, PWA, and native builds

The original plan used one React application for web, PWA, and Capacitor-wrapped Android and iOS builds. It rejected a React Native rewrite because that would split the UI, authorization paths, and tests across two codebases.

The release scope was revised on October 4, 2026: desktop Workspace and Zalo Mini App only. Mobile PWA and standalone Android and iOS releases are out of scope. Existing PWA and Capacitor code remains in the repository; its presence does not make it a release requirement. Desktop packaging is still undecided.
