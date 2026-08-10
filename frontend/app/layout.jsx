export const metadata = {
  title: "Employee Wellness Tracker Nexus",
  description: "Wellness tracking with role-based access for Admins, Managers, and Employees.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
