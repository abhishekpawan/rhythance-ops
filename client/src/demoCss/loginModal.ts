// Demo-only stylesheet, at its old place in cssOrder.ts. The file exists on multiple-login-demo and the public
// mirror only (docs/automated-tasks/sync-commit-to-production-branches.md); on the four production branches the
// pattern matches nothing and this module is empty, so cssOrder.ts is the same file on every branch and builds
// everywhere. Its own module because Vite moves a glob import to the top of the module that contains it.
import.meta.glob("../styles/components/demo-login-modal.css", { eager: true });
