import { useAuthStore } from './store/authStore';
import Login from './components/Login';
import TeacherDashboard from './components/TeacherDashboard';
import StudentDashboard from './components/StudentDashboard';

export default function App() {
  const user = useAuthStore((state) => state.user);

  if (!user) {
    return <Login />;
  }

  return user.role === 'teacher' ? <TeacherDashboard /> : <StudentDashboard />;
}
