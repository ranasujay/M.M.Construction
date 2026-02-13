import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import CustomerLedger from './pages/CustomerLedger';
import Products from './pages/Products';
import Bills from './pages/Bills';
import CreateBill from './pages/CreateBill';
import BillDetail from './pages/BillDetail';
import EditBill from './pages/EditBill';
import Payments from './pages/Payments';
import Promises from './pages/Promises';
import Reports from './pages/Reports';
import ActivityLogs from './pages/ActivityLogs';
import Users from './pages/Users';
import DueList from './pages/DueList';
import AdvanceList from './pages/AdvanceList';
import WorkerDashboard from './pages/WorkerDashboard';
import Workers from './pages/Workers';
import WorkerProfile from './pages/WorkerProfile';
import WorkerAttendance from './pages/WorkerAttendance';
import WorkerAdvances from './pages/WorkerAdvances';
import WorkerSalary from './pages/WorkerSalary';
import ProductSales from './pages/ProductSales';
import RawMaterials from './pages/RawMaterials';
import PurchaseEntry from './pages/PurchaseEntry';
import PurchaseHistory from './pages/PurchaseHistory';
import StockDashboard from './pages/StockDashboard';
import StockLogs from './pages/StockLogs';
import Suppliers from './pages/Suppliers';
import SupplierLedger from './pages/SupplierLedger';
import PurchaseEdit from './pages/PurchaseEdit';
import PurchaseExpenses from './pages/PurchaseExpenses';
import FinancialYearClose from './pages/FinancialYearClose';
import BackupRestore from './pages/BackupRestore';

// Protected route wrapper
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen"><div className="text-xl text-gray-400">Loading...</div></div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

// Owner-only route
const OwnerRoute = ({ children }) => {
  const { isOwner, loading } = useAuth();
  if (loading) return null;
  if (!isOwner) return <Navigate to="/" replace />;
  return children;
};

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="customers" element={<Customers />} />
        <Route path="customers/:id/ledger" element={<CustomerLedger />} />
        <Route path="products" element={<Products />} />
        <Route path="bills" element={<Bills />} />
        <Route path="bills/create" element={<CreateBill />} />
        <Route path="bills/:id" element={<BillDetail />} />
        <Route path="bills/:id/edit" element={<EditBill />} />
        <Route path="payments" element={<Payments />} />
        <Route path="dues" element={<DueList />} />
        <Route path="advances" element={<AdvanceList />} />
        <Route path="promises" element={<Promises />} />
        <Route path="reports" element={<Reports />} />
        <Route
          path="activity-logs"
          element={<OwnerRoute><ActivityLogs /></OwnerRoute>}
        />
        <Route
          path="product-sales"
          element={<OwnerRoute><ProductSales /></OwnerRoute>}
        />
        <Route
          path="users"
          element={<OwnerRoute><Users /></OwnerRoute>}
        />
        {/* Stock & Materials Module (Owner Only) */}
        <Route
          path="stock-dashboard"
          element={<OwnerRoute><StockDashboard /></OwnerRoute>}
        />
        <Route
          path="raw-materials"
          element={<OwnerRoute><RawMaterials /></OwnerRoute>}
        />
        <Route
          path="purchases"
          element={<OwnerRoute><PurchaseHistory /></OwnerRoute>}
        />
        <Route
          path="purchases/create"
          element={<OwnerRoute><PurchaseEntry /></OwnerRoute>}
        />
        <Route
          path="purchases/:id/edit"
          element={<OwnerRoute><PurchaseEdit /></OwnerRoute>}
        />
        <Route
          path="suppliers"
          element={<OwnerRoute><Suppliers /></OwnerRoute>}
        />
        <Route
          path="suppliers/:id/ledger"
          element={<OwnerRoute><SupplierLedger /></OwnerRoute>}
        />
        <Route
          path="stock-logs"
          element={<OwnerRoute><StockLogs /></OwnerRoute>}
        />
        <Route
          path="purchase-expenses"
          element={<OwnerRoute><PurchaseExpenses /></OwnerRoute>}
        />
        <Route
          path="admin/financial-year-close"
          element={<OwnerRoute><FinancialYearClose /></OwnerRoute>}
        />
        <Route
          path="admin/backup-restore"
          element={<OwnerRoute><BackupRestore /></OwnerRoute>}
        />
        {/* Worker & Payroll Module (Owner Only) */}
        <Route
          path="worker-dashboard"
          element={<OwnerRoute><WorkerDashboard /></OwnerRoute>}
        />
        <Route
          path="workers"
          element={<OwnerRoute><Workers /></OwnerRoute>}
        />
        <Route
          path="workers/:id"
          element={<OwnerRoute><WorkerProfile /></OwnerRoute>}
        />
        <Route
          path="worker-attendance"
          element={<OwnerRoute><WorkerAttendance /></OwnerRoute>}
        />
        <Route
          path="worker-advances"
          element={<OwnerRoute><WorkerAdvances /></OwnerRoute>}
        />
        <Route
          path="worker-salary"
          element={<OwnerRoute><WorkerSalary /></OwnerRoute>}
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
