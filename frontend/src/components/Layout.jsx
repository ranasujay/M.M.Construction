import { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  HiOutlineHome,
  HiOutlineUsers,
  HiOutlineCube,
  HiOutlineDocumentText,
  HiOutlineCreditCard,
  HiOutlineClock,
  HiOutlineChartBar,
  HiOutlineClipboardList,
  HiOutlineUserGroup,
  HiOutlineLogout,
  HiOutlineMenu,
  HiOutlineX,
  HiOutlineExclamation,
  HiOutlineCash,
  HiOutlineClipboardCheck,
  HiOutlineBriefcase,
  HiOutlineCalculator,
  HiOutlineViewGrid,
  HiOutlineDatabase,
  HiOutlineShoppingCart,
  HiOutlineClipboard,
  HiOutlineAdjustments,
  HiOutlineArchive,
  HiOutlineChevronDown,
  HiOutlineCloudDownload,
  HiOutlineCog,
} from 'react-icons/hi';

// ─── Navigation categories ──────────────────────────────────────────

const mainItems = [
  { path: '/', label: 'Dashboard', icon: HiOutlineHome },
];

const salesCategory = {
  label: 'Sales & Billing',
  icon: HiOutlineDocumentText,
  items: [
    { path: '/customers', label: 'Customers', icon: HiOutlineUsers },
    { path: '/products', label: 'Products', icon: HiOutlineCube },
    { path: '/bills', label: 'Bills', icon: HiOutlineDocumentText },
    { path: '/payments', label: 'Payments', icon: HiOutlineCreditCard },
    { path: '/dues', label: 'Due List', icon: HiOutlineExclamation },
    { path: '/advances', label: 'Advances', icon: HiOutlineCash },
  ],
};

const trackingCategory = {
  label: 'Follow-ups & Reports',
  icon: HiOutlineChartBar,
  items: [
    { path: '/promises', label: 'Follow-ups', icon: HiOutlineClock },
    { path: '/reports', label: 'Reports', icon: HiOutlineChartBar },
  ],
};

const stockCategory = {
  label: 'Stock & Materials',
  icon: HiOutlineDatabase,
  ownerOnly: true,
  items: [
    { path: '/stock-dashboard', label: 'Stock Overview', icon: HiOutlineViewGrid },
    { path: '/raw-materials', label: 'Raw Materials', icon: HiOutlineDatabase },
    { path: '/suppliers', label: 'Suppliers', icon: HiOutlineUsers },
    { path: '/purchases', label: 'Purchases', icon: HiOutlineShoppingCart },
    { path: '/purchase-expenses', label: 'Expenses', icon: HiOutlineAdjustments },
    { path: '/stock-logs', label: 'Stock Logs', icon: HiOutlineClipboard },
  ],
};

const workerCategory = {
  label: 'Workers & Payroll',
  icon: HiOutlineBriefcase,
  ownerOnly: true,
  items: [
    { path: '/worker-dashboard', label: 'Payroll Dashboard', icon: HiOutlineViewGrid },
    { path: '/workers', label: 'Workers', icon: HiOutlineBriefcase },
    { path: '/worker-attendance', label: 'Attendance', icon: HiOutlineClipboardCheck },
    { path: '/worker-advances', label: 'Worker Advances', icon: HiOutlineCash },
    { path: '/worker-salary', label: 'Salary Sheet', icon: HiOutlineCalculator },
  ],
};

const adminCategory = {
  label: 'Administration',
  icon: HiOutlineCog,
  ownerOnly: true,
  items: [
    { path: '/product-sales', label: 'Product Sales', icon: HiOutlineChartBar },
    { path: '/activity-logs', label: 'Activity Logs', icon: HiOutlineClipboardList },
    { path: '/users', label: 'Users', icon: HiOutlineUserGroup },
    { path: '/admin/financial-year-close', label: 'FY Closing', icon: HiOutlineArchive },
    { path: '/admin/backup-restore', label: 'Backup & Restore', icon: HiOutlineCloudDownload },
  ],
};

const allCategories = [salesCategory, trackingCategory, stockCategory, workerCategory, adminCategory];

// ─── Collapsible category dropdown ───────────────────────────────────

function NavCategory({ category, closeSidebar }) {
  const location = useLocation();
  const isAnyActive = category.items.some((item) => {
    if (item.path === '/') return location.pathname === '/';
    return location.pathname.startsWith(item.path);
  });

  const [open, setOpen] = useState(isAnyActive);
  const Icon = category.icon;

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
          isAnyActive
            ? 'text-primary-400 bg-primary-600/10'
            : 'text-gray-400 hover:bg-dark-hover hover:text-gray-200'
        }`}
      >
        <span className="flex items-center gap-3">
          <Icon className="w-5 h-5 flex-shrink-0" />
          {category.label}
        </span>
        <HiOutlineChevronDown
          className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <div
        className={`overflow-hidden transition-all duration-200 ${
          open ? 'max-h-[500px] opacity-100 mt-1' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="ml-3 pl-3 border-l border-dark-border space-y-0.5">
          {category.items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              onClick={closeSidebar}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-primary-600/20 text-primary-400'
                    : 'text-gray-500 hover:bg-dark-hover hover:text-gray-300'
                }`
              }
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Layout() {
  const { user, logout, isOwner } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const closeSidebar = () => setSidebarOpen(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const categories = allCategories.filter((c) => !c.ownerOnly || isOwner);

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo + close button */}
      <div className="px-5 py-4 border-b border-dark-border flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-primary-400">M.M. Construction</h1>
          <p className="text-[10px] text-gray-600 mt-0.5">Billing & Ledger System</p>
        </div>
        <button
          onClick={closeSidebar}
          className="lg:hidden p-1 text-gray-500 hover:text-gray-300 rounded-lg"
        >
          <HiOutlineX className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto scrollbar-thin">
        {/* Dashboard (always visible, no category) */}
        {mainItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end
            onClick={closeSidebar}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-primary-600/20 text-primary-400 border-l-2 border-primary-400'
                  : 'text-gray-400 hover:bg-dark-hover hover:text-gray-200'
              }`
            }
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {item.label}
          </NavLink>
        ))}

        {/* Divider */}
        <div className="pt-1 pb-1">
          <div className="border-t border-dark-border" />
        </div>

        {/* Category dropdowns */}
        {categories.map((cat) => (
          <NavCategory key={cat.label} category={cat} closeSidebar={closeSidebar} />
        ))}
      </nav>

      {/* User info & logout */}
      <div className="px-4 py-3 border-t border-dark-border">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
            {user?.name?.charAt(0)?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-200 truncate">{user?.name}</p>
            <p className="text-[10px] text-gray-500 capitalize">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-400 hover:text-red-400 hover:bg-dark-hover rounded-lg transition-colors"
        >
          <HiOutlineLogout className="w-4 h-4" />
          Logout
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex lg:flex-col w-60 bg-dark-card border-r border-dark-border flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Sidebar - Mobile */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-dark-card border-r border-dark-border transform transition-transform duration-300 ease-in-out lg:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarContent />
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar - mobile */}
        <header className="bg-dark-card border-b border-dark-border px-4 py-3 flex items-center justify-between lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-dark-hover rounded-lg transition-colors">
            <HiOutlineMenu className="w-6 h-6" />
          </button>
          <h1 className="text-base font-bold text-primary-400">M.M. Construction</h1>
          <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-xs font-bold text-white">
            {user?.name?.charAt(0)?.toUpperCase()}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
