import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import { 
    Calendar, User, Flag, Paperclip, MessageSquare, 
    Trash2, Download, Plus, ArrowLeft, Clock, Edit2, Save, X 
} from 'lucide-react';

export default function UserTaskDetailsPage() {
  const { teamId, taskId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Data State
  const [task, setTask] = useState(null);
  const [team, setTeam] = useState(null);
  const [comments, setComments] = useState([]);
  const [attachments, setAttachments] = useState([]);
  
  // UI State
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Edit Mode
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    status: '',
    priority: '',
    due_date: '',
    assigned_to: '' // <--- 1. Προσθήκη πεδίου
  });

  const fetchData = async () => {
    try {
      const [taskRes, commentsRes, attachmentsRes, teamRes] = await Promise.all([
        api.tasks.getDetails(taskId),
        api.tasks.getComments(taskId),
        api.tasks.getAttachments(taskId),
        api.teams.getOne(teamId)
      ]);
      
      setTask(taskRes.data);
      setTeam(teamRes.data);
      
      setEditForm({
        title: taskRes.data.title,
        description: taskRes.data.description || '',
        status: taskRes.data.status,
        priority: taskRes.data.priority,
        due_date: taskRes.data.due_date.split('T')[0],
        assigned_to: taskRes.data.assigned_to // <--- 2. Αρχικοποίηση
      });

      setComments(commentsRes.data);
      setAttachments(attachmentsRes.data);
    } catch (err) {
      alert("Failed to load task details.");
      navigate(`/teams/${teamId}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [taskId]);

  // --- HANDLERS ---

  const handleStatusChange = async (newStatus) => {
    setUpdatingStatus(true);
    try {
        await api.tasks.updateStatus(taskId, newStatus);
        setTask({ ...task, status: newStatus });
        setEditForm(prev => ({ ...prev, status: newStatus }));
    } catch (err) {
        alert("Failed to update status.");
    } finally {
        setUpdatingStatus(false);
    }
  };

  const handleUpdateTask = async () => {
    try {
      const payload = {
        ...editForm,
        due_date: new Date(editForm.due_date).toISOString() 
      };
      const { data } = await api.tasks.updateDetails(taskId, payload);
      setTask(data);
      setIsEditing(false);
    } catch (err) {
      alert(`Failed to update task: ${err.response?.data?.detail || 'Unknown error'}`);
    }
  };

  const handleDeleteTask = async () => {
    if (!window.confirm("Are you sure you want to delete this task?")) return;
    try {
      await api.tasks.delete(taskId);
      navigate(`/teams/${teamId}`);
    } catch (err) {
      alert("Failed to delete task.");
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    try {
      const { data } = await api.tasks.addComment(taskId, commentText);
      setComments([...comments, data]);
      setCommentText('');
    } catch (err) {
      alert("Failed to add comment.");
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm("Delete this comment?")) return;
    try {
      await api.tasks.deleteComment(taskId, commentId);
      setComments(comments.filter(c => c.id !== commentId));
    } catch (err) {
      alert("Failed to delete comment.");
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const { data } = await api.tasks.uploadAttachment(taskId, formData);
      setAttachments([...attachments, data]);
    } catch (err) {
      alert("Failed to upload file.");
    } finally {
      setUploading(false);
      e.target.value = null;
    }
  };

  const handleDownload = async (attachmentId, filename) => {
    try {
      const response = await api.tasks.downloadFile(taskId, attachmentId);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Failed to download file.");
    }
  };

  const handleDeleteAttachment = async (attachmentId, filename) => {
    if (!window.confirm(`Delete file "${filename}"?`)) return;
    try {
      await api.tasks.deleteAttachment(taskId, attachmentId);
      setAttachments(attachments.filter(a => a.id !== attachmentId));
    } catch (err) {
      alert("Failed to delete file.");
    }
  };

  if (loading) return <div className="p-8 text-center">Loading Task...</div>;
  if (!task) return null;

  const isAssignedToMe = task.assigned_to === user.username;
  const isLeader = team?.leader_id === user.username;

  const getPriorityColor = (p) => {
    if (p === 'URGENT') return 'text-red-600 bg-red-50 border-red-200';
    if (p === 'MEDIUM') return 'text-orange-600 bg-orange-50 border-orange-200';
    return 'text-green-600 bg-green-50 border-green-200';
  };

  return (
    <div className="max-w-5xl mx-auto pb-10">
      <button onClick={() => navigate(`/teams/${teamId}`)} className="mb-4 flex items-center text-gray-500 hover:text-gray-800">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Team
      </button>

      {/* MAIN CARD */}
      <div className="bg-white shadow-lg rounded-lg overflow-hidden mb-8 border border-gray-200">
        
        <div className="p-6 border-b border-gray-100 bg-gray-50">
            {isEditing ? (
                // EDIT MODE (Leader Only)
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Task Title</label>
                        <input className="w-full text-xl font-bold border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                            value={editForm.title} onChange={(e) => setEditForm({...editForm, title: e.target.value})} />
                    </div>
                    <div className="flex flex-wrap gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Status</label>
                            <select className="border p-2 rounded text-sm bg-white outline-none"
                                value={editForm.status} onChange={(e) => setEditForm({...editForm, status: e.target.value})}>
                                <option value="TODO">TODO</option>
                                <option value="IN_PROGRESS">IN PROGRESS</option>
                                <option value="DONE">DONE</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Priority</label>
                            <select className="border p-2 rounded text-sm bg-white outline-none"
                                value={editForm.priority} onChange={(e) => setEditForm({...editForm, priority: e.target.value})}>
                                <option value="LOW">LOW</option>
                                <option value="MEDIUM">MEDIUM</option>
                                <option value="URGENT">URGENT</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Due Date</label>
                            <input type="date" className="border p-2 rounded text-sm bg-white outline-none"
                                value={editForm.due_date} onChange={(e) => setEditForm({...editForm, due_date: e.target.value})} />
                        </div>
                        
                        {/* --- 3. ΝΕΟ ΠΕΔΙΟ: ASSIGNED TO --- */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Assigned To</label>
                            <select 
                                className="border p-2 rounded text-sm bg-white outline-none min-w-[150px]"
                                value={editForm.assigned_to} 
                                onChange={(e) => setEditForm({...editForm, assigned_to: e.target.value})}
                            >
                                {team.member_ids.map(member => (
                                    <option key={member} value={member}>
                                        {member}
                                    </option>
                                ))}
                            </select>
                        </div>
                        {/* ---------------------------------- */}

                    </div>
                    <div className="flex space-x-2 pt-2">
                        <button onClick={handleUpdateTask} className="flex items-center bg-green-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-green-700"><Save className="w-4 h-4 mr-2" /> Save Changes</button>
                        <button onClick={() => setIsEditing(false)} className="flex items-center bg-gray-500 text-white px-4 py-2 rounded text-sm font-medium hover:bg-gray-600"><X className="w-4 h-4 mr-2" /> Cancel</button>
                    </div>
                </div>
            ) : (
                // VIEW MODE
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
                            {task.title}
                            {isLeader && (
                                <button onClick={() => setIsEditing(true)} className="text-gray-400 hover:text-blue-600 transition-colors" title="Edit Task">
                                    <Edit2 className="w-5 h-5" />
                                </button>
                            )}
                        </h1>
                        <div className="flex items-center space-x-3 text-sm">
                            <span className={`px-2 py-1 rounded border text-xs font-bold ${getPriorityColor(task.priority)}`}>{task.priority}</span>
                            <span className={`flex items-center px-2 py-1 rounded border text-xs font-bold ${task.status === 'DONE' ? 'bg-green-100 text-green-700' : task.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                                {task.status.replace('_', ' ')}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Status Update for Assignee */}
                        {isAssignedToMe && !isEditing && (
                            <div className="flex items-center bg-white p-2 rounded border border-blue-100 shadow-sm">
                                <span className="text-xs font-bold text-gray-500 mr-2 uppercase">Update Status:</span>
                                <select value={task.status} onChange={(e) => handleStatusChange(e.target.value)} disabled={updatingStatus} className="text-sm border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 cursor-pointer">
                                    <option value="TODO">To Do</option>
                                    <option value="IN_PROGRESS">In Progress</option>
                                    <option value="DONE">Done</option>
                                </select>
                            </div>
                        )}
                        {/* Delete Button for Leader */}
                        {isLeader && (
                            <button onClick={handleDeleteTask} className="text-red-500 hover:bg-red-50 p-2 rounded transition" title="Delete Task">
                                <Trash2 className="w-6 h-6" />
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
        
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-4">
                <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Description</h3>
                    {isEditing ? (
                        <textarea className="w-full border p-3 rounded-lg text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none" rows="6" value={editForm.description} onChange={(e) => setEditForm({...editForm, description: e.target.value})} />
                    ) : (
                        <div className="text-gray-700 whitespace-pre-wrap leading-relaxed">{task.description || <span className="italic text-gray-400">No description provided.</span>}</div>
                    )}
                </div>
            </div>
            <div className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-100 h-fit">
                <div className="flex items-center">
                    <User className="w-4 h-4 text-gray-400 mr-3" />
                    <div>
                        <div className="text-xs text-gray-400 uppercase">Assigned To</div>
                        <Link to={`/admin/users/${task.assigned_to}`} className={`text-sm font-medium hover:underline ${isAssignedToMe ? 'text-blue-600 font-bold' : 'text-blue-600'}`}>
                            {task.assigned_to} {isAssignedToMe && '(You)'}
                        </Link>
                    </div>
                </div>
                <div className="flex items-center"><Flag className="w-4 h-4 text-gray-400 mr-3" /><div><div className="text-xs text-gray-400 uppercase">Created By</div><span className="text-sm font-medium text-gray-700">{task.created_by}</span></div></div>
                <div className="flex items-center"><Calendar className="w-4 h-4 text-gray-400 mr-3" /><div><div className="text-xs text-gray-400 uppercase">Due Date</div><span className="text-sm font-medium text-gray-700">{new Date(task.due_date).toLocaleDateString()}</span></div></div>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* ATTACHMENTS */}
        <div className="bg-white shadow rounded-lg p-6 h-fit">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-700 flex items-center"><Paperclip className="w-5 h-5 mr-2" /> Attachments ({attachments.length})</h3>
                <label className="cursor-pointer text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded flex items-center transition"><Plus className="w-3 h-3 mr-1" /> {uploading ? 'Uploading...' : 'Upload'}<input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} /></label>
            </div>
            <ul className="space-y-2">
                {attachments.map(file => (
                    <li key={file.id} className="flex justify-between items-center p-3 bg-gray-50 rounded border border-gray-100 hover:bg-blue-50 transition group">
                        <div className="flex items-center overflow-hidden"><Paperclip className="w-4 h-4 text-gray-400 mr-3 flex-shrink-0" /><div className="flex flex-col"><span className="text-sm text-gray-700 truncate font-medium">{file.filename}</span><span className="text-xs text-gray-400">by {file.uploaded_by}</span></div></div>
                        <div className="flex space-x-2">
                            <button onClick={() => handleDownload(file.id, file.filename)} className="text-blue-500 hover:text-blue-700 p-1"><Download className="w-4 h-4" /></button>
                            {(file.uploaded_by === user.username || isLeader) && <button onClick={() => handleDeleteAttachment(file.id, file.filename)} className="text-gray-400 hover:text-red-600 p-1"><Trash2 className="w-4 h-4" /></button>}
                        </div>
                    </li>
                ))}
                {attachments.length === 0 && <li className="text-sm text-gray-400 italic text-center py-4">No files attached yet.</li>}
            </ul>
        </div>

        {/* COMMENTS */}
        <div className="bg-white shadow rounded-lg p-6">
            <h3 className="font-bold text-gray-700 flex items-center mb-4"><MessageSquare className="w-5 h-5 mr-2" /> Comments ({comments.length})</h3>
            <div className="space-y-4 mb-6 max-h-[400px] overflow-y-auto pr-2">
                {comments.map(comment => {
                    const isMember = team && team.member_ids.includes(comment.created_by);
                    const isLeaderCommenter = team && team.leader_id === comment.created_by;
                    const isFormerMember = team && !isMember && !isLeaderCommenter;

                    return (
                        <div key={comment.id} className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                            <div className="flex justify-between items-start mb-1">
                                <div className="flex items-center flex-wrap">
                                    <span className="text-sm font-bold text-gray-800 mr-2">{comment.created_by}</span>
                                    {isFormerMember && (
                                        <span className="text-[10px] text-red-600 italic bg-red-100 border border-red-200 px-1.5 py-0.5 rounded mr-2 font-medium">
                                            [former member]
                                        </span>
                                    )}
                                    <span className="text-xs text-gray-400 flex items-center"><Clock className="w-3 h-3 mr-1" />{new Date(comment.created_at).toLocaleString()}</span>
                                </div>
                                {(comment.created_by === user.username || isLeader) && <button onClick={() => handleDeleteComment(comment.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>}
                            </div>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.text}</p>
                        </div>
                    );
                })}
                {comments.length === 0 && <p className="text-sm text-gray-400 italic text-center">No comments yet.</p>}
            </div>
            <form onSubmit={handleAddComment} className="relative">
                <textarea className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none resize-none" rows="3" placeholder="Write a comment..." value={commentText} onChange={(e) => setCommentText(e.target.value)}></textarea>
                <div className="flex justify-end mt-2"><button type="submit" disabled={!commentText.trim()} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">Post Comment</button></div>
            </form>
        </div>
      </div>
    </div>
  );
}