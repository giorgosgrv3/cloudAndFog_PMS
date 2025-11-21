import { useEffect, useState } from 'react';
import { api } from '../api/endpoints';
import { Trash2, Filter, Users, Plus, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import SearchableSelect from '../components/SearchableSelect';

export default function AdminTeamsPage() {
  const [teams, setTeams] = useState([]);
  const [allUsers, setAllUsers] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [selectedLeader, setSelectedLeader] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  
  // --- ΔΙΟΡΘΩΣΗ ΕΔΩ: leader_id -> leader_username ---
  const [newTeam, setNewTeam] = useState({
    name: '',
    description: '',
    leader_username: '' 
  });

  // Βελτιωμένη συνάρτηση Error Message για να βλέπουμε τα validations
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

  const fetchData = async () => {
    setLoading(true);
    try {
      const [teamsRes, usersRes] = await Promise.all([
        api.teams.getAll(),
        api.users.getAll()
      ]);

      setTeams(teamsRes.data);
      const activeUsers = usersRes.data.filter(u => u.active); 
      setAllUsers(activeUsers);

    } catch (err) {
      console.error(err);
      setError('Failed to load data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const userOptions = allUsers.map(user => ({
    value: user.username,
    label: `${user.username} (${user.first_name} ${user.last_name}) - [${user.role}]`
  }));

  // --- HANDLERS ---
  const handleCreateTeam = async (e) => {
    e.preventDefault();
    
    // Validation με το σωστό πεδίο
    if (!newTeam.name || !newTeam.leader_username) {
        alert("Please provide a team name and select a leader.");
        return;
    }

    setCreating(true);
    try {
        // Το newTeam έχει πλέον { name, description, leader_username }
        // που είναι ακριβώς αυτό που περιμένει το Backend
        const { data } = await api.teams.create(newTeam);
        
        setTeams([...teams, data]);
        // Reset form
        setNewTeam({ name: '', description: '', leader_username: '' });
        setIsModalOpen(false);
    } catch (err) {
        alert(`Failed to create team: ${getErrorMessage(err)}`);
    } finally {
        setCreating(false);
    }
  };

  const handleDelete = async (teamId, teamName) => {
    if (!window.confirm(`Are you sure you want to delete the team "${teamName}"?`)) return;

    try {
      await api.teams.delete(teamId);
      setTeams(teams.filter(t => t.id !== teamId));
    } catch (err) {
      alert(`Failed to delete team: ${getErrorMessage(err)}`);
    }
  };

  const filteredTeams = selectedLeader 
    ? teams.filter(team => team.leader_id === selectedLeader)
    : teams;

  if (loading) return <div className="p-6">Loading teams...</div>;
  if (error) return <div className="p-6 text-red-500 font-bold">{error}</div>;

  return (
    <div className="relative min-h-[500px]">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Team Management</h1>
        
        <button 
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition shadow-sm flex items-center"
            onClick={() => setIsModalOpen(true)}
        >
            <Plus className="w-5 h-5 mr-1" /> Create New Team
        </button>
      </div>

      {/* --- FILTERS BAR --- */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
        <div className="flex items-center text-gray-500 md:col-span-1">
            <Filter className="w-5 h-5 mr-2" />
            <span className="font-medium">Filter by Leader:</span>
        </div>
        
        <div className="md:col-span-2">
            <SearchableSelect 
                options={userOptions}
                value={selectedLeader}
                onChange={(val) => setSelectedLeader(val)}
                placeholder="Search leader..."
            />
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Leader</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Members</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredTeams.length > 0 ? (
              filteredTeams.map((team) => (
                <tr key={team.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-gray-900">
                        <Link to={`/admin/teams/${team.id}`} className="text-blue-600 hover:text-blue-900 hover:underline">
                            {team.name}
                        </Link>
                    </div>
                    <div className="text-sm text-gray-500 truncate max-w-xs" title={team.description}>
                        {team.description || <em>No description</em>}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs mr-2">
                            {team.leader_id.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="text-sm text-gray-900 font-medium">{team.leader_id}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-600">
                        <Users className="w-4 h-4 mr-1 text-gray-400" />
                        {team.member_ids.length} members
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(team.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button 
                      onClick={() => handleDelete(team.id, team.name)}
                      className="text-red-600 hover:text-red-900 p-2 hover:bg-red-50 rounded-full transition"
                      title="Delete Team"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                  {teams.length === 0 
                    ? "No teams found. Click 'Create New Team' to start!" 
                    : "No teams match the selected filter."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                <div className="flex justify-between items-center p-4 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-800">Create New Team</h2>
                    <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleCreateTeam} className="p-4 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Team Name *</label>
                        <input 
                            type="text" 
                            required
                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            value={newTeam.name}
                            onChange={(e) => setNewTeam({...newTeam, name: e.target.value})}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <textarea 
                            rows="3"
                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            value={newTeam.description}
                            onChange={(e) => setNewTeam({...newTeam, description: e.target.value})}
                        />
                    </div>

                    {/* LEADER SELECT */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Assign Leader *</label>
                        
                        <SearchableSelect 
                            options={userOptions}
                            value={newTeam.leader_username} // <-- Changed
                            onChange={(val) => setNewTeam({...newTeam, leader_username: val})} // <-- Changed
                            placeholder="Search for a user..."
                        />
                        
                        <p className="text-xs text-gray-500 mt-1">
                            Select a user to lead this team.
                        </p>
                    </div>

                    <div className="flex justify-end space-x-3 pt-4">
                        <button 
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            disabled={creating || allUsers.length === 0}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {creating ? 'Creating...' : 'Create Team'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
}