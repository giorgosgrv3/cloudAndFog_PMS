import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/endpoints';
import { CheckCircle, Filter, ArrowUpDown, Briefcase, Calendar, Flag } from 'lucide-react';

export default function UserMyTasksPage() {
  const [tasks, setTasks] = useState([]);
  const [teams, setTeams] = useState([]); 
  const [loadingTasks, setLoadingTasks] = useState(true);

  // Filters State
  const [statusFilter, setStatusFilter] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [sortByDue, setSortByDue] = useState(false);

  // 1. Φόρτωση Ομάδων
  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const { data } = await api.teams.getAll();
        setTeams(data);
      } catch (err) {
        console.error("Failed to load teams for filter", err);
      }
    };
    fetchTeams();
  }, []);

  // 2. Φόρτωση Tasks
  useEffect(() => {
    const fetchTasks = async () => {
      setLoadingTasks(true);
      try {
        const tasksParams = {};
        if (statusFilter) tasksParams.status = statusFilter;
        if (sortByDue) tasksParams.sort_by_due = true;

        const { data } = await api.tasks.getMyTasks(tasksParams);
        
        // --- DEBUG LOGS ---
        console.log("Fetched Tasks:", data);
        // ------------------
        
        setTasks(data);
      } catch (err) {
        console.error("Failed to load tasks", err);
      } finally {
        setLoadingTasks(false);
      }
    };

    fetchTasks();
  }, [statusFilter, sortByDue]);

  const getTeamName = (teamId) => {
    const team = teams.find(t => t.id === teamId);
    return team ? team.name : `Unknown Team (${teamId})`;
  };

  // --- DEBUG LOGIC ---
  if (teamFilter) {
      console.log("Filtering by Team ID:", teamFilter);
      tasks.forEach(t => console.log(`Task "${t.title}" has team_id:`, t.team_id));
  }
  // -------------------

  const filteredTasks = teamFilter 
    ? tasks.filter(t => t.team_id === teamFilter)
    : tasks;

  const getPriorityColor = (p) => {
    if (p === 'URGENT') return 'text-red-600 bg-red-50 border-red-200';
    if (p === 'MEDIUM') return 'text-orange-600 bg-orange-50 border-orange-200';
    return 'text-green-600 bg-green-50 border-green-200';
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center">
          <CheckCircle className="w-6 h-6 mr-2 text-blue-600" /> My Tasks
        </h1>
      </div>

      {/* FILTERS */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="relative">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Status</label>
            <div className="relative">
                <select 
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full appearance-none bg-gray-50 border border-gray-300 text-gray-700 py-2 px-3 pr-8 rounded focus:outline-none focus:border-blue-500 text-sm"
                >
                    <option value="">All Statuses</option>
                    <option value="TODO">To Do</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="DONE">Done</option>
                </select>
                <Filter className="w-4 h-4 absolute right-2 top-2.5 text-gray-400 pointer-events-none" />
            </div>
        </div>

        <div className="relative">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Team</label>
            <div className="relative">
                <select 
                    value={teamFilter}
                    onChange={(e) => setTeamFilter(e.target.value)}
                    className="w-full appearance-none bg-gray-50 border border-gray-300 text-gray-700 py-2 px-3 pr-8 rounded focus:outline-none focus:border-blue-500 text-sm"
                >
                    <option value="">All Teams</option>
                    {teams.length > 0 ? (
                        teams.map(team => (
                            <option key={team.id} value={team.id}>{team.name}</option>
                        ))
                    ) : (
                        <option disabled>No teams found</option>
                    )}
                </select>
                <Briefcase className="w-4 h-4 absolute right-2 top-2.5 text-gray-400 pointer-events-none" />
            </div>
        </div>

        <div className="flex items-end">
            <button 
                onClick={() => setSortByDue(!sortByDue)}
                className={`w-full flex items-center justify-center px-4 py-2 rounded border text-sm font-medium transition-colors h-[38px]
                    ${sortByDue 
                        ? 'bg-blue-100 border-blue-300 text-blue-800' 
                        : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}
            >
                <ArrowUpDown className="w-4 h-4 mr-2" />
                Sort by Date
            </button>
        </div>
        
        <div className="flex items-end">
            {(statusFilter || teamFilter || sortByDue) && (
                <button 
                    onClick={() => { setStatusFilter(''); setTeamFilter(''); setSortByDue(false); }}
                    className="text-sm text-red-500 hover:text-red-700 underline h-[38px] flex items-center"
                >
                    Clear Filters
                </button>
            )}
        </div>
      </div>

      {/* LIST */}
      {loadingTasks ? (
          <div className="p-8 text-center">Loading your tasks...</div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
            {filteredTasks.length > 0 ? (
                filteredTasks.map(task => (
                    <div key={task.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow flex flex-col md:flex-row justify-between md:items-center gap-4">
                        <div className="flex-1">
                            <div className="flex items-center mb-1">
                                <Link 
                                    to={`/teams/${task.team_id}/tasks/${task.id}`} 
                                    className="text-lg font-bold text-gray-800 hover:text-blue-600 hover:underline"
                                >
                                    {task.title}
                                </Link>
                                <span className={`ml-3 px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${getPriorityColor(task.priority)}`}>
                                    {task.priority}
                                </span>
                            </div>
                            <div className="flex items-center text-sm text-gray-500">
                                <Briefcase className="w-3 h-3 mr-1" />
                                <span className="mr-4">{getTeamName(task.team_id)}</span>
                                
                                <Flag className="w-3 h-3 mr-1" />
                                <span>Created by {task.created_by}</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="text-right">
                                <div className="text-xs text-gray-400 uppercase font-bold mb-1">Due Date</div>
                                <div className="flex items-center text-sm text-gray-700 font-medium">
                                    <Calendar className="w-4 h-4 mr-1 text-gray-400" />
                                    {new Date(task.due_date).toLocaleDateString()}
                                </div>
                            </div>

                            <div className={`px-3 py-1 rounded-full text-xs font-bold border
                                ${task.status === 'DONE' ? 'bg-green-100 text-green-700 border-green-200' : 
                                  task.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700 border-blue-200' : 
                                  'bg-gray-100 text-gray-700 border-gray-200'}`}>
                                {task.status.replace('_', ' ')}
                            </div>
                        </div>
                    </div>
                ))
            ) : (
                <div className="text-center py-12 bg-white rounded-lg border border-gray-200 border-dashed">
                    <div className="text-gray-400 mb-2">No tasks found matching your filters.</div>
                    {/* DEBUG HINT: Αν η λίστα είναι άδεια ενώ δεν πρέπει */}
                    {teamFilter && (
                        <p className="text-xs text-red-400 mt-2">
                            Debug: Filtered by TeamID: {teamFilter}
                        </p>
                    )}
                </div>
            )}
        </div>
      )}
    </div>
  );
}