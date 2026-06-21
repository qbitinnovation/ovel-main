import fs from 'fs';
import path from 'path';

const PORTALS = ['turf-manager', 'shareholder'];
const PAGES = [
  { folder: 'users', moduleKey: 'user_permission', basePage: 'superadmin/users/page' },
  { folder: 'accounts', moduleKey: 'accounts_finance', basePage: 'superadmin/accounts/page' },
  { folder: 'inventory', moduleKey: 'inventory', basePage: 'superadmin/inventory/page' },
  { folder: 'sales', moduleKey: 'inventory_sales', basePage: 'superadmin/sales/page' },
  { folder: 'checklist', moduleKey: 'daily_operations', basePage: 'superadmin/checklists/page' },
  { folder: 'maintenance', moduleKey: 'maintenance_tasks', basePage: 'superadmin/maintenance/page' },
  { folder: 'safety-checkout', moduleKey: 'safety_checklist', basePage: 'superadmin/safety-checkout/page' },
  { folder: 'reports', moduleKey: 'reports_analytics', basePage: 'superadmin/reports/page' },
  { folder: 'mom', moduleKey: 'malayalam_mom', basePage: 'superadmin/mom/page' },
  { folder: 'bookings', moduleKey: 'bookings', basePage: 'superadmin/bookings/page' },
  { folder: 'notifications', moduleKey: 'notifications', basePage: 'superadmin/notifications/page' },
  { folder: 'audit-log', moduleKey: 'audit_log', basePage: 'superadmin/audit/page' },
];

const COMPONENT_TEMPLATE = `import BasePage from '../../{basePage}';
import PermissionScopedAdminPage from '@/components/PermissionScopedAdminPage';

export default function WrapperPage() {
  return (
    <PermissionScopedAdminPage moduleKey="{moduleKey}">
      <BasePage />
    </PermissionScopedAdminPage>
  );
}
`;

function createPages() {
  const root = path.join(process.cwd(), 'app');

  for (const portal of PORTALS) {
    for (const page of PAGES) {
      const dirPath = path.join(root, portal, page.folder);
      const filePath = path.join(dirPath, 'page.tsx');

      // Skip creating if we shouldn't overwrite existing ones, but we can check if it exists.
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      // If it exists, let's not overwrite unless we know it's a wrapper.
      // But actually, for turf-manager, checklist/maintenance/safety-checkout already exist.
      // We should check if we should replace them. 
      // The user said: "Currently, clicking a dynamically mapped module in these portals would result in a 404 error because the pages don't exist in those folders. We will create wrapper pages for all missing modules across both portals."
      // So ONLY for missing modules!
      if (!fs.existsSync(filePath)) {
        const content = COMPONENT_TEMPLATE
          .replace('{basePage}', page.basePage)
          .replace('{moduleKey}', page.moduleKey);
        
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`Created ${portal}/${page.folder}/page.tsx`);
      } else {
        console.log(`Skipping ${portal}/${page.folder}/page.tsx (already exists)`);
      }
    }
  }
}

createPages();
