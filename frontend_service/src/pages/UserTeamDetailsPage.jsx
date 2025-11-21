import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import { Users, Briefcase, ArrowLeft, User, Filter, UserPlus, X, Trash2, Plus, Loader } from 'lucide-react'; // Add Loader icon
import SearchableSelect from '../components/SearchableSelect';

export default function UserTeamDetailsPage() {
  const { teamId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [team, setTeam] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [allUsers, setAllUsers] = useState([]); 
  const [loading, setLoading] = useState(true);
  
  // --- UPDATED ADD MEMBER STATES ---
  const [isAdding, setIsAdding] = useState(false);
  const [selectedNewMembers, setSelectedNewMembers] = useState([]); // Array αντί για string
  const [isSubmittingMembers, setIsSubmittingMembers] = useState(false); // Loading state για το add
  
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '', description: '', assigned_to: '', priority: 'MEDIUM', due_date: ''
  });

  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        const [teamRes, tasksRes, usersRes] = await Promise.all([
            api.teams.getOne(teamId),
            api.tasks.getByTeam(teamId),
            api.users.getAll() 
        ]);
        setTeam(teamRes.data);
        setTasks(tasksRes.data);
        setAllUsers(usersRes.data);
      } catch (err) {
        console.error(err);
        alert("Access denied or team not found.");
        navigate('/teams');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [teamId, navigate]);

  // --- UPDATED HANDLER: ADD MULTIPLE MEMBERS ---
  const handleAddMembers = async (e) => {
    if (e) e.preventDefault();
    if (selectedNewMembers.length === 0) return;

    setIsSubmittingMembers(true);
    try {
        // Επειδή το API δέχεται έναν-έναν, κάνουμε map και Promise.all
        // Χρησιμοποιούμε allSettled για να μην σταματήσει αν ένας αποτύχει
        const requests = selectedNewMembers.map(username => 
            api.teams.addMember(teamId, username)
        );

        const results = await Promise.allSettled(requests);
        
        // Ελέγχουμε ποιοι πέτυχαν
        const successfulAdds = [];
        const failedAdds = [];

        results.forEach((res, index) => {
            if (res.status === 'fulfilled') {
                successfulAdds.push(selectedNewMembers[index]);
            } else {
                failedAdds.push(selectedNewMembers[index]);
            }
        });

        // Ενημέρωση state με τους επιτυχόντες
        if (successfulAdds.length > 0) {
            setTeam(prev => ({
                ...prev,
                member_ids: [...prev.member_ids, ...successfulAdds]
            }));
        }

        // Μηνύματα
        if (failedAdds.length > 0) {
            alert(`Added ${successfulAdds.length} users. Failed to add: ${failedAdds.join(', ')}`);
        } 

        // Reset
        setSelectedNewMembers([]);
        setIsAdding(false);

    } catch (err) {
        alert("An unexpected error occurred while adding members.");
    } finally {
        setIsSubmittingMembers(false);
    }
  };

  const handleRemoveMember = async (memberUsername) => {
    if (!window.confirm(`Are you sure you want to remove ${memberUsername} from the team?`)) return;
    try {
        await api.teams.removeMember(teamId, memberUsername);
        setTeam({ ...team, member_ids: team.member_ids.filter(m => m !== memberUsername) });
    } catch (err) {
        alert("Failed to remove member.");
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTask.title || !newTask.assigned_to || !newTask.due_date) {
        alert("Please fill in all required fields.");
        return;
    }
    setCreatingTask(true);
    try {
        const payload = {
            team_id: teamId,
            title: newTask.title,
            description: newTask.description,
            assigned_to: newTask.assigned_to,
            priority: newTask.priority,
            due_date: new Date(newTask.due_date).toISOString(),
            status: 'TODO'
        };
        const { data } = await api.tasks.create(payload);
        setTasks([...tasks, data]);
        setNewTask({ title: '', description: '', assigned_to: '', priority: 'MEDIUM', due_date: '' });
        setIsTaskModalOpen(false);
    } catch (err) {
        const msg = err.response?.data?.detail || 'Failed to create task.';
        alert(`Error: ${typeof msg === 'object' ? JSON.stringify(msg) : msg}`);
    } finally {
        setCreatingTask(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading Team...</div>;
  if (!team) return null;

  const isLeader = team.leader_id === user.username;
  const filteredTasks = statusFilter ? tasks.filter(t => t.status === statusFilter) : tasks;

  // Options
  const availableUsersOptions = allUsers
    .filter(u => !team.member_ids.includes(u.username))
    .map(u => ({ value: u.username, label: `${u.username} (${u.first_name} ${u.last_name})` }));

  const memberOptions = team.member_ids.map(m => ({ value: m, label: m }));

  return (
    <div className="max-w-6xl mx-auto relative min-h-screen">
      <button onClick={() => navigate('/teams')} className="mb-4 flex items-center text-gray-500 hover:text-gray-800">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to My Teams
      </button>

      <div className={`bg-white shadow-md rounded-lg p-6 mb-6 border-l-4 ${isLeader ? 'border-blue-500' : 'border-gray-300'}`}>
        <div className="flex justify-between items-start">
            <div>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                    {team.name}
                    {isLeader && (
                        <span className="ml-3 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full uppercase font-bold tracking-wide">Team Leader</span>
                    )}
                </h1>
                <p className="text-gray-500 mt-2">{team.description || "No description provided."}</p>
            </div>
            {isLeader && (
                <button onClick={() => setIsTaskModalOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition shadow-sm flex items-center">
                    <Plus className="w-4 h-4 mr-1" /> New Task
                </button>
            )}
        </div>
        <div className="mt-6 flex flex-wrap gap-6 text-sm text-gray-600 border-t pt-4">
            <div className="flex items-center"><User className="w-4 h-4 mr-2" /> Leader: <span className="font-medium ml-1">{team.leader_id}</span></div>
            <div className="flex items-center"><Users className="w-4 h-4 mr-2" /> {team.member_ids.length} Members</div>
            <div className="flex items-center"><Briefcase className="w-4 h-4 mr-2" /> {tasks.length} Tasks</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* LEFT: MEMBERS LIST */}
        <div className="lg:col-span-1">
            <div className="bg-white shadow rounded-lg p-4">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-gray-700 uppercase text-xs tracking-wider">Team Members</h3>
                    {isLeader && !isAdding && (
                        <button onClick={() => setIsAdding(true)} className="text-blue-600 hover:bg-blue-50 p-1 rounded transition" title="Add Members">
                            <UserPlus className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {isAdding && (
                    <div className="mb-4 p-3 bg-blue-50 rounded border border-blue-100 shadow-sm">
                        <div className="text-xs font-semibold text-blue-800 mb-2">Add Members</div>
                        
                        {/* --- MULTI SELECT --- */}
                        <SearchableSelect 
                            options={availableUsersOptions}
                            value={selectedNewMembers}
                            onChange={setSelectedNewMembers}
                            placeholder="Select users..."
                            multiple={true} // <--- MULTI SELECT ENABLED
                        />

                        <div className="flex justify-end space-x-2 mt-3">
                            <button 
                                onClick={() => setIsAdding(false)} 
                                className="text-xs text-gray-500 hover:text-gray-700"
                                disabled={isSubmittingMembers}
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleAddMembers} 
                                className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50 flex items-center"
                                disabled={selectedNewMembers.length === 0 || isSubmittingMembers}
                            >
                                {isSubmittingMembers && <Loader className="w-3 h-3 mr-1 animate-spin" />}
                                Add ({selectedNewMembers.length})
                            </button>
                        </div>
                    </div>
                )}

                <ul className="space-y-3">
                    {team.member_ids.map(member => (
                        <li key={member} className="flex items-center justify-between group">
                            <div className="flex items-center">
                                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold mr-3 ${member === team.leader_id ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>{member.substring(0, 2).toUpperCase()}</div>
                                <span className={`text-sm ${member === user.username ? 'font-bold text-gray-900' : 'text-gray-600'}`}>{member} {member === user.username && '(You)'}</span>
                            </div>
                            {isLeader && member !== user.username && (
                                <button onClick={() => handleRemoveMember(member)} className="text-gray-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity" title="Remove User"><Trash2 className="w-4 h-4" /></button>
                            )}
                        </li>
                    ))}
                </ul>
            </div>
        </div>

        {/* RIGHT: TASKS LIST */}
        <div className="lg:col-span-3">
            <div className="bg-white shadow rounded-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                    <h3 className="font-bold text-gray-700 uppercase text-xs tracking-wider">Tasks</h3>
                    <div className="relative">
                        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="appearance-none bg-white border border-gray-300 text-gray-700 py-1 px-3 pr-8 rounded text-xs focus:outline-none focus:border-blue-500">
                            <option value="">All Statuses</option>
                            <option value="TODO">To Do</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="DONE">Done</option>
                        </select>
                        <Filter className="w-3 h-3 absolute right-2 top-2 text-gray-400 pointer-events-none" />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase w-1/2">Task</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredTasks.length > 0 ? (
                                filteredTasks.map(task => {
                                    const isAssignedToMe = task.assigned_to === user.username;
                                    return (
                                        <tr key={task.id} className={`hover:bg-gray-50 transition ${isAssignedToMe ? 'bg-blue-50/30' : ''}`}>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-between">
                                                    <Link to={`/teams/${teamId}/tasks/${task.id}`} className="text-sm font-medium text-gray-900 hover:text-blue-600 hover:underline">
                                                        {task.title}
                                                    </Link>
                                                    {isAssignedToMe && <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">Assigned to me</span>}
                                                </div>
                                                {!isAssignedToMe && <div className="text-xs text-gray-400 mt-1">Assigned to: {task.assigned_to}</div>}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 py-1 text-xs rounded-full font-semibold ${task.status === 'DONE' ? 'bg-green-100 text-green-800' : task.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}`}>{task.status.replace('_', ' ')}</span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(task.due_date).toLocaleDateString()}</td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`text-xs font-bold ${task.priority === 'URGENT' ? 'text-red-600' : task.priority === 'MEDIUM' ? 'text-orange-500' : 'text-green-600'}`}>{task.priority}</span>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr><td colSpan="4" className="px-6 py-8 text-center text-gray-500 text-sm">No tasks found.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

      </div>

      {/* CREATE TASK MODAL (Same as before) */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                <div className="flex justify-between items-center p-4 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-800">Create New Task</h2>
                    <button onClick={() => setIsTaskModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={handleCreateTask} className="p-4 space-y-4">
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Task Title *</label><input type="text" required className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500 outline-none" value={newTask.title} onChange={(e) => setNewTask({...newTask, title: e.target.value})} /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Description</label><textarea rows="3" className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500 outline-none" value={newTask.description} onChange={(e) => setNewTask({...newTask, description: e.target.value})} /></div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Assign To *</label>
                        <SearchableSelect options={memberOptions} value={newTask.assigned_to} onChange={(val) => setNewTask({...newTask, assigned_to: val})} placeholder="Select team member..." />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">Priority *</label><select className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white" value={newTask.priority} onChange={(e) => setNewTask({...newTask, priority: e.target.value})}><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="URGENT">Urgent</option></select></div>
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">Due Date *</label><input type="date" required className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500 outline-none" value={newTask.due_date} onChange={(e) => setNewTask({...newTask, due_date: e.target.value})} /></div>
                    </div>
                    <div className="flex justify-end space-x-3 pt-4">
                        <button type="button" onClick={() => setIsTaskModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md">Cancel</button>
                        <button type="submit" disabled={creatingTask} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50">{creatingTask ? 'Creating...' : 'Create Task'}</button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
}