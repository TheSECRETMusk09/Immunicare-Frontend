import React from "react";
import { Link } from "react-router-dom";
import GuardianModuleHeader from "../components/GuardianModuleHeader";
import { Alert, Button } from "../components/UI";
import { MessageSquare, Bell } from "lucide-react";

export default function GuardianMessagesPage() {
  return (
    <div className="guardian-page-wrapper min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200 guardian-module-mobile-header-spacing">
      <GuardianModuleHeader
        title="Messages"
        subtitle="Secure guardian messaging workspace"
        icon={<MessageSquare className="w-8 h-8 text-white" />}
      />

      <main className="guardian-page-content space-y-4 md:space-y-5 lg:space-y-6">
        <Alert variant="warning">
          Guardian messaging is not yet available in this release because the current
          backend conversation tables are still scoped to admin participants only.
          This route now presents an explicit blocker instead of incorrectly showing
          the notifications module.
        </Alert>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Messaging rollout blocker
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Admin-to-admin conversations are implemented on the backend, but guardian
            participation is not yet supported by the live conversation schema or route
            authorization model.
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            <Button asChild variant="secondary">
              <Link to="/guardian/notifications">
                <Bell className="mr-2 h-4 w-4" />
                Open notifications
              </Link>
            </Button>
            <Button asChild>
              <Link to="/guardian/profile">Return to profile</Link>
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
