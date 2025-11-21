import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api/endpoints';
import { Users, Trash2, Save, X, UserMinus, Edit2, Briefcase, Calendar, Filter, ArrowUpDown, Plus } from 'lucide-react';
import SearchableSelect from '../components/SearchableSelect';

export default function AdminTeamDetailsPage() {
  const { teamId } = useParams();
  const navigate = useNavigate();

  // Data States
  const [team, setTeam] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [leaders, setLeaders] = useState([]); // (Δεν χρησιμοποιείται πια για το dropdown, αλλά το κρατάμε αν χρειαστεί)
  const [allUsers, setAllUsers] = useState([]); 
  
  // UI States
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', description: '' });
  
  // Change Leader State
  const [isChangingLeader, setIsChangingLeader] = useState(false);
  const [newLeader, setNewLeader] = useState('');

  // Add Member State
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [selectedNewMember, setSelectedNewMember] = useState('');

  // Task Filters
  const [taskStatusFilter, setTaskStatusFilter] = useState('');
  const [sortByDue, setSortByDue] = useState(false);

  const getErrorMessage = (err) => {
    if (err.response?.data?.detail) {
        const detail = err.response.data.detail;
        if (typeof detail === 'object') {
            return JSON.stringify(detail);
        }
        return detail;
    }
    return 'An unexpected error occurred.';
  };

  const fetchTasks = useCallback(async () => {
    try {
      const filters = {};
      if (taskStatusFilter) filters.status = taskStatusFilter;
      if (sortByDue) filters.sort_by_due = true;
      const { data } = await api.tasks.getByTeam(teamId, filters);
      setTasks(data);
    } catch (err) {
      console.error("Failed to load tasks filters", err);
    }
  }, [teamId, taskStatusFilter, sortByDue]);

  useEffect(() => {
    const initData = async () => {
      try {
        const [teamRes, usersRes] = await Promise.all([
          api.teams.getOne(teamId),
          api.users.getAll()
        ]);
        
        setTeam(teamRes.data);
        setEditForm({ name: teamRes.data.name, description: teamRes.data.description });
        
        // Αποθηκεύουμε όλους τους χρήστες (ενεργούς)
        setAllUsers(usersRes.data.filter(u => u.active));
        setLeaders(usersRes.data.filter(u => u.role === 'team_leader')); // (Προαιρετικό πλέον)
        
        await fetchTasks();

      } catch (err) {
        alert(`Failed to load team details: ${getErrorMessage(err)}`);
        navigate('/admin/teams');
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, [teamId, navigate]);

  useEffect(() => {
    if (!loading) fetchTasks();
  }, [fetchTasks]);

  // --- HANDLERS ---

  const handleUpdateDetails = async () => {
    try {
      await api.teams.update(teamId, editForm);
      setTeam({ ...team, ...editForm });
      setIsEditing(false);
    } catch (err) {
      alert(`Failed to update team details: ${getErrorMessage(err)}`);
    }
  };

  const handleChangeLeader = async () => {
    if (!newLeader) return;
    if (!window.confirm(`Change leader to ${newLeader}?`)) return;
    
    try {
      await api.teams.assignLeader(teamId, newLeader);
      setTeam({ ...team, leader_id: newLeader });
      setIsChangingLeader(false);
      setNewLeader('');
    } catch (err) {
      alert(`Failed to change leader: ${getErrorMessage(err)}`);
    }
  };

  const handleRemoveMember = async (memberUsername) => {
    if (!window.confirm(`Remove ${memberUsername} from the team?`)) return;
    try {
      await api.teams.removeMember(teamId, memberUsername);
      setTeam({
        ...team,
        member_ids: team.member_ids.filter(m => m !== memberUsername)
      });
    } catch (err) {
      alert(`Failed to remove member: ${getErrorMessage(err)}`);
    }
  };

  const handleAddMember = async () => {
    if (!selectedNewMember) return;
    try {
        await api.teams.addMember(teamId, selectedNewMember);
        setTeam({
            ...team,
            member_ids: [...team.member_ids, selectedNewMember]
        });
        setSelectedNewMember('');
        setIsAddingMember(false);
    } catch (err) {
        alert(`Failed to add member: ${getErrorMessage(err)}`);
    }
  };

  const handleDeleteTeam = async () => {
    if (!window.confirm("Are you sure you want to DELETE this team? All tasks will be lost!")) return;
    try {
      await api.teams.delete(teamId);
      navigate('/admin/teams');
    } catch (err) {
      alert(`Failed to delete team: ${getErrorMessage(err)}`);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading Team...</div>;
  if (!team) return null;

  // --- 1. LEADER OPTIONS: ONLY EXISTING MEMBERS ---
  const leaderOptions = allUsers
    .filter(u => team.member_ids.includes(u.username)) // Κρατάμε μόνο όσους είναι ήδη μέλη
    .map(u => ({ 
        value: u.username, 
        label: `${u.username} (${u.first_name} ${u.last_name}) - [${u.role}]` 
    }));
  
  // --- 2. ADD MEMBER OPTIONS: ONLY NON-MEMBERS ---
  const availableMembersOptions = allUsers
    .filter(u => !team.member_ids.includes(u.username))
    .map(u => ({ value: u.username, label: `${u.username} (${u.first_name} ${u.last_name})` }));

  return (
    <div>
      <button onClick={() => navigate('/admin/teams')} className="mb-4 text-gray-500 hover:text-gray-800">
        ← Back to Teams
      </button>

      {/* HEADER SECTION */}
      <div className="bg-white shadow-md rounded-lg p-6 mb-6 border-l-4 border-blue-600">
        <div className="flex justify-between items-start">
          <div className="w-full">
            {isEditing ? (
              <div className="space-y-3 max-w-lg">
                <input 
                  className="text-2xl font-bold border p-2 rounded w-full"
                  value={editForm.name}
                  onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                />
                <textarea 
                  className="text-gray-600 border p-2 rounded w-full"
                  rows="2"
                  value={editForm.description}
                  onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                />
                <div className="flex space-x-2">
                    <button onClick={handleUpdateDetails} className="flex items-center bg-green-600 text-white px-3 py-1 rounded text-sm"><Save className="w-4 h-4 mr-1" /> Save</button>
                    <button onClick={() => setIsEditing(false)} className="flex items-center bg-gray-500 text-white px-3 py-1 rounded text-sm"><X className="w-4 h-4 mr-1" /> Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                    {team.name}
                    <button onClick={() => setIsEditing(true)} className="ml-3 text-gray-400 hover:text-blue-600" title="Edit Details"><Edit2 className="w-5 h-5" /></button>
                </h1>
                <p className="text-gray-500 mt-2">{team.description || "No description provided."}</p>
              </>
            )}
          </div>
          <button onClick={handleDeleteTeam} className="text-red-600 hover:bg-red-50 p-2 rounded transition" title="Delete Team"><Trash2 className="w-6 h-6" /></button>
        </div>
        <div className="mt-6 flex flex-wrap gap-6 text-sm text-gray-600 border-t pt-4">
            <div className="flex items-center"><Calendar className="w-4 h-4 mr-2" /> Created: {new Date(team.created_at).toLocaleDateString()}</div>
            <div className="flex items-center"><Users className="w-4 h-4 mr-2" /> Members: {team.member_ids.length}</div>
            <div className="flex items-center"><Briefcase className="w-4 h-4 mr-2" /> Total Tasks: {tasks.length}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN */}
        <div className="space-y-6">
            {/* LEADER CARD */}
            <div className="bg-white shadow rounded-lg p-6">
                <h3 className="font-bold text-gray-700 mb-4 uppercase text-xs tracking-wider">Team Leader</h3>
                {!isChangingLeader ? (
                    <div className="flex justify-between items-center">
                        <div className="flex items-center">
                            <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold mr-3">{team.leader_id.substring(0, 2).toUpperCase()}</div>
                            <Link to={`/admin/users/${team.leader_id}`} className="font-medium text-gray-900 hover:underline">{team.leader_id}</Link>
                        </div>
                        <button onClick={() => setIsChangingLeader(true)} className="text-xs text-blue-600 hover:underline">Change</button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <SearchableSelect options={leaderOptions} value={newLeader} onChange={setNewLeader} placeholder="Select member..." />
                        
                        <p className="text-[10px] text-gray-500 leading-tight">
                            Note: Only existing team members can be promoted to Leader.
                        </p>

                        <div className="flex space-x-2 text-xs">
                             <button onClick={handleChangeLeader} disabled={!newLeader} className="bg-blue-600 text-white px-2 py-1 rounded disabled:opacity-50">Confirm</button>
                            <button onClick={() => setIsChangingLeader(false)} className="bg-gray-200 text-gray-700 px-2 py-1 rounded">Cancel</button>
                        </div>
                    </div>
                )}
            </div>

            {/* MEMBERS LIST */}
            <div className="bg-white shadow rounded-lg p-6">
                <h3 className="font-bold text-gray-700 mb-4 uppercase text-xs tracking-wider">Team Members ({team.member_ids.length})</h3>
                
                {/* ADD MEMBER (ADMIN) */}
                {!isAddingMember && (
                    <button onClick={() => setIsAddingMember(true)} className="text-xs text-blue-600 hover:underline mb-4 flex items-center">+ Add Member</button>
                )}
                {isAddingMember && (
                    <div className="mb-4 p-2 bg-blue-50 rounded border border-blue-100">
                        <SearchableSelect options={availableMembersOptions} value={selectedNewMember} onChange={setSelectedNewMember} placeholder="Select user..." />
                        <div className="flex justify-end space-x-2 mt-2">
                            <button onClick={() => setIsAddingMember(false)} className="text-xs text-gray-500">Cancel</button>
                            <button onClick={handleAddMember} disabled={!selectedNewMember} className="text-xs bg-blue-600 text-white px-2 py-1 rounded">Add</button>
                        </div>
                    </div>
                )}

                <ul className="divide-y divide-gray-100">
                    {team.member_ids.map(member => (
                        <li key={member} className="py-3 flex justify-between items-center">
                            <div className="flex items-center">
                                <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 text-xs mr-3">{member.substring(0, 2).toUpperCase()}</div>
                                <Link to={`/admin/users/${member}`} className="text-sm font-medium text-gray-700 hover:underline">{member}</Link>
                            </div>
                            {member !== team.leader_id && (
                                <button onClick={() => handleRemoveMember(member)} className="text-red-400 hover:text-red-600 p-1" title="Remove member"><UserMinus className="w-4 h-4" /></button>
                            )}
                        </li>
                    ))}
                    {team.member_ids.length === 0 && <li className="text-sm text-gray-400 italic">No members yet.</li>}
                </ul>
            </div>
        </div>

        {/* RIGHT COLUMN: TASKS */}
        <div className="md:col-span-2">
            <div className="bg-white shadow rounded-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-3 sm:space-y-0">
                    <h3 className="font-bold text-gray-700 uppercase text-xs tracking-wider">Team Tasks</h3>
                    <div className="flex items-center space-x-2">
                        <div className="relative">
                            <select value={taskStatusFilter} onChange={(e) => setTaskStatusFilter(e.target.value)} className="appearance-none bg-white border border-gray-300 text-gray-700 py-1 px-3 pr-8 rounded leading-tight focus:outline-none focus:bg-white focus:border-blue-500 text-xs font-medium">
                                <option value="">ALL STATUSES</option>
                                <option value="TODO">TODO</option>
                                <option value="IN_PROGRESS">IN PROGRESS</option>
                                <option value="DONE">DONE</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700"><Filter className="w-3 h-3" /></div>
                        </div>
                        <button onClick={() => setSortByDue(!sortByDue)} className={`flex items-center px-3 py-1 rounded border text-xs font-medium transition-colors ${sortByDue ? 'bg-blue-100 border-blue-300 text-blue-800' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}><ArrowUpDown className="w-3 h-3 mr-1" /> Sort by Due Date</button>
                    </div>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned To</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {tasks.length > 0 ? (
                                tasks.map(task => (
                                    <tr key={task.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 text-sm font-bold">
                                            <Link to={`/admin/tasks/${task.id}`} className="text-blue-600 hover:text-blue-800 hover:underline">{task.title}</Link>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">
                                            <Link to={`/admin/users/${task.assigned_to}`} className="hover:underline">{task.assigned_to}</Link>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 text-xs rounded-full font-semibold ${task.status === 'DONE' ? 'bg-green-100 text-green-800' : task.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>{task.status.replace('_', ' ')}</span>
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            <span className={`font-bold text-xs ${task.priority === 'URGENT' ? 'text-red-600' : task.priority === 'MEDIUM' ? 'text-orange-500' : 'text-green-600'}`}>{task.priority}</span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">{new Date(task.due_date).toLocaleDateString()}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan="5" className="px-6 py-8 text-center text-gray-500">No tasks found matching current filters.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}