import AccelerationPlan    from './pages/AccelerationPlan';
import AdminDashboard      from './pages/AdminDashboard';
import AdminUsers          from './pages/AdminUsers';
import BankSetup           from './pages/BankSetup';
import BudgetCalculator    from './pages/BudgetCalculator';
import Dashboard           from './pages/Dashboard';
import IncomeAccelerator   from './pages/IncomeAccelerator';
import LeakageDetector     from './pages/LeakageDetector';
import PayYourselfFirst    from './pages/PayYourselfFirst';
import ReserveGoal         from './pages/ReserveGoal';
import ReserveUsage        from './pages/ReserveUsage';
import SmartBudgetSystem   from './pages/SmartBudgetSystem';
import UserSettings        from './pages/UserSettings';
import WeeklyRoutine       from './pages/WeeklyRoutine';
import __Layout            from './Layout.jsx';

export const PAGES = {
  AccelerationPlan,
  AdminDashboard,
  AdminUsers,
  BankSetup,
  BudgetCalculator,
  Dashboard,
  IncomeAccelerator,
  LeakageDetector,
  PayYourselfFirst,
  ReserveGoal,
  ReserveUsage,
  SmartBudgetSystem,
  UserSettings,
  WeeklyRoutine,
};

export const pagesConfig = {
  mainPage: 'Dashboard',
  Pages: PAGES,
  Layout: __Layout,
};
