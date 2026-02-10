import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
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
} from 'react-icons/hi';

const navItems = [
  { path: '/', label: 'Dashboard', icon: HiOutlineHome },
  { path: '/customers', label: 'Customers', icon: HiOutlineUsers },
  { path: '/products', label: 'Products', icon: HiOutlineCube },
  { path: '/bills', label: 'Bills', icon: HiOutlineDocumentText },
  { path: '/payments', label: 'Payments', icon: HiOutlineCreditCard },
  { path: '/dues', label: 'Due List', icon: HiOutlineExclamation },
  { path: '/advances', label: 'Advances', icon: HiOutlineCash },
  { path: '/promises', label: 'Follow-ups', icon: HiOutlineClock },
  { path: '/reports', label: 'Reports', icon: HiOutlineChartBar },
];

const ownerItems = [
  { path: '/product-sales', label: 'Product Sales', icon: HiOutlineChartBar },
  { path: '/activity-logs', label: 'Activity Logs', icon: HiOutlineClipboardList },
  { path: '/users', label: 'Users', icon: HiOutlineUserGroup },
];

const workerModuleItems = [
  { path: '/worker-dashboard', label: 'Payroll Dashboard', icon: HiOutlineViewGrid },
  { path: '/workers', label: 'Workers', icon: HiOutlineBriefcase },
  { path: '/worker-attendance', label: 'Attendance', icon: HiOutlineClipboardCheck },
  { path: '/worker-advances', label: 'Worker Advances', icon: HiOutlineCash },
  { path: '/worker-salary', label: 'Salary Sheet', icon: HiOutlineCalculator },
];

export default function Layout() {
  const { user, logout, isOwner } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const allNavItems = isOwner ? [...navItems, ...ownerItems] : navItems;
  const workerNav = isOwner ? workerModuleItems : [];

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-dark-border">
        <h1 className="text-xl font-bold text-primary-400">M.M. Construction</h1>
        <p className="text-xs text-gray-500 mt-1">Billing & Ledger System</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {allNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            onClick={() => setSidebarOpen(false)}
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

        {/* Worker & Payroll Section */}
        {workerNav.length > 0 && (
          <>
            <div className="pt-4 pb-2 px-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600">Workers & Payroll</p>
            </div>
            {workerNav.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
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
          </>
        )}
      </nav>

      {/* User info & logout */}
      <div className="px-4 py-4 border-t border-dark-border">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-primary-600 flex items-center justify-center text-sm font-bold text-white">
            {user?.name?.charAt(0)?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-200 truncate">{user?.name}</p>
            <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-400 hover:text-red-400 hover:bg-dark-hover rounded-lg transition-colors"
        >
          <HiOutlineLogout className="w-5 h-5" />
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
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex lg:flex-col w-64 bg-dark-card border-r border-dark-border flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Sidebar - Mobile */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-dark-card border-r border-dark-border transform transition-transform duration-300 lg:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarContent />
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-dark-card border-b border-dark-border px-4 py-3 flex items-center gap-4 lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-400 hover:text-gray-200">
            <HiOutlineMenu className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold text-primary-400">M.M. Construction</h1>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
