import CalendarioCliente   from './pages/CalendarioCliente';
import CalendarioAdmin     from './pages/CalendarioAdmin';
import AccelerationPlan    from './pages/AccelerationPlan';
import AdminDashboard      from './pages/AdminDashboard';
import AdminUsers          from './pages/AdminUsers';
import AdminAnalytics      from './pages/AdminAnalytics';
import AdminOnboarding     from './pages/AdminOnboarding';
import BankSetup           from './pages/BankSetup';
import BudgetCalculator    from './pages/BudgetCalculator';
import Dashboard           from './pages/Dashboard';
import LeakageDetector     from './pages/LeakageDetector';
import MonthlyClosing      from './pages/MonthlyClosing';
import PayYourselfFirst    from './pages/PayYourselfFirst';
import ReserveGoal         from './pages/ReserveGoal';
import ReserveUsage        from './pages/ReserveUsage';
import UserSettings        from './pages/UserSettings';
import WeeklyRoutine       from './pages/WeeklyRoutine';
import __Layout            from './Layout.jsx';
import SterlingAgent       from './pages/SterlingAgent';
import AdminSterling       from './pages/AdminSterling';

export const PAGES = {
  AccelerationPlan,
  AdminDashboard,
  AdminUsers,
  AdminAnalytics,
  AdminOnboarding,
  AdminSterling,
  BankSetup,
  BudgetCalculator,
  CalendarioAdmin,
  CalendarioCliente,
  Dashboard,
  LeakageDetector,
  MonthlyClosing,
  PayYourselfFirst,
  ReserveGoal,
  ReserveUsage,
  SterlingAgent,
  UserSettings,
  WeeklyRoutine,
};

export const pagesConfig = {
  mainPage: 'Dashboard',
  Pages: PAGES,
  Layout: __Layout,
};
