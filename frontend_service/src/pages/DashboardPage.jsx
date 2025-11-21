import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/endpoints';
import { CheckCircle, Clock, AlertCircle, Users, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function DashboardPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Φέρνουμε παράλληλα τα tasks μου και τις ομάδες μου
        const [tasksRes, teamsRes] = await Promise.all([
          api.tasks.getMyTasks(),
          api.teams.getAll()
        ]);
        setTasks(tasksRes.data);
        setTeams(teamsRes.data);
      } catch (err) {
        console.error("Failed to load dashboard data", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) return <div className="p-8 text-center">Loading Dashboard...</div>;

  // Υπολογισμός Στατιστικών
  const todoCount = tasks.filter(t => t.status === 'TODO').length;
  const progressCount = tasks.filter(t => t.status === 'IN_PROGRESS').length;
  const doneCount = tasks.filter(t => t.status === 'DONE').length;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Welcome back, {user?.first_name}! 👋</h1>
      <p className="text-gray-500 mb-8">Here's what's happening with your projects today.</p>

      {/* --- STATS CARDS --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        
        {/* TODO Card */}
        <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-gray-400 flex items-center justify-between">
            <div>
                <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">To Do</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">{todoCount}</p>
            </div>
            <div className="p-3 bg-gray-100 rounded-full text-gray-600">
                <AlertCircle className="w-6 h-6" />
            </div>
        </div>

        {/* IN PROGRESS Card */}
        <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-blue-500 flex items-center justify-between">
            <div>
                <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">In Progress</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">{progressCount}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full text-blue-600">
                <Clock className="w-6 h-6" />
            </div>
        </div>

        {/* DONE Card */}
        <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-green-500 flex items-center justify-between">
            <div>
                <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Completed</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">{doneCount}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full text-green-600">
                <CheckCircle className="w-6 h-6" />
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* --- MY TEAMS --- */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h3 className="font-bold text-gray-700 flex items-center">
                    <Users className="w-4 h-4 mr-2" /> My Teams
                </h3>
                {/* Θα ενεργοποιήσουμε αυτό το Link στο επόμενο βήμα */}
                {/* <Link to="/teams" className="text-xs text-blue-600 hover:underline">View All</Link> */}
            </div>
            <div className="divide-y divide-gray-100">
                {teams.length > 0 ? (
                    teams.map(team => (
                        <div key={team.id} className="p-4 hover:bg-gray-50 transition flex justify-between items-center">
                            <div>
                                <div className="font-bold text-gray-800">{team.name}</div>
                                <div className="text-xs text-gray-500">Leader: {team.leader_id}</div>
                            </div>
                            <div className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                                {team.member_ids.length} Members
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="p-6 text-center text-gray-500 text-sm">
                        You are not part of any team yet.
                    </div>
                )}
            </div>
        </div>

        {/* --- MY TASKS (Preview) --- */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h3 className="font-bold text-gray-700 flex items-center">
                    <CheckCircle className="w-4 h-4 mr-2" /> My Recent Tasks
                </h3>
                {/* Θα ενεργοποιήσουμε αυτό το Link αργότερα */}
                {/* <Link to="/tasks" className="text-xs text-blue-600 hover:underline">View All</Link> */}
            </div>
            <div className="divide-y divide-gray-100">
                {tasks.length > 0 ? (
                    tasks.slice(0, 5).map(task => ( // Δείχνουμε μόνο τα 5 πρώτα
                        <div key={task.id} className="p-4 hover:bg-gray-50 transition">
                            <div className="flex justify-between items-start mb-1">
                                <div className="font-medium text-gray-800">{task.title}</div>
                                <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase
                                    ${task.priority === 'URGENT' ? 'bg-red-100 text-red-600' : 
                                      task.priority === 'MEDIUM' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>
                                    {task.priority}
                                </span>
                            </div>
                            <div className="flex justify-between items-center mt-2">
                                <span className={`text-xs px-2 py-0.5 rounded 
                                    ${task.status === 'DONE' ? 'bg-green-50 text-green-700' : 
                                      task.status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                                    {task.status.replace('_', ' ')}
                                </span>
                                <span className="text-xs text-gray-400">
                                    Due: {new Date(task.due_date).toLocaleDateString()}
                                </span>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="p-6 text-center text-gray-500 text-sm">
                        No tasks assigned to you.
                    </div>
                )}
            </div>
             {tasks.length > 5 && (
                <div className="p-2 text-center bg-gray-50 border-t border-gray-100">
                    <span className="text-xs text-gray-500">And {tasks.length - 5} more...</span>
                </div>
            )}
        </div>

      </div>
    </div>
  );
}