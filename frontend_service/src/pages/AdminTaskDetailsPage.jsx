import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api/endpoints';
import { 
    Calendar, User, Flag, Paperclip, MessageSquare, 
    Trash2, Download, Plus, ArrowLeft, Clock, Edit2, Save, X 
} from 'lucide-react';

export default function AdminTaskDetailsPage() {
  const { taskId } = useParams();
  const navigate = useNavigate();

  // Data State
  const [task, setTask] = useState(null);
  const [comments, setComments] = useState([]);
  const [attachments, setAttachments] = useState([]);
  
  // UI State
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [uploading, setUploading] = useState(false);

  // --- EDIT MODE STATES ---
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    status: '',
    priority: '',
    due_date: ''
  });

  // --- INITIAL FETCH ---
  const fetchData = async () => {
    try {
      const [taskRes, commentsRes, attachmentsRes] = await Promise.all([
        api.tasks.getDetails(taskId),
        api.tasks.getComments(taskId),
        api.tasks.getAttachments(taskId)
      ]);
      
      setTask(taskRes.data);
      
      // Initialize Edit Form
      setEditForm({
        title: taskRes.data.title,
        description: taskRes.data.description || '',
        status: taskRes.data.status,
        priority: taskRes.data.priority,
        due_date: taskRes.data.due_date.split('T')[0] // Format YYYY-MM-DD for input
      });

      setComments(commentsRes.data);
      setAttachments(attachmentsRes.data);
    } catch (err) {
      alert("Failed to load task details.");
      navigate('/admin/teams');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [taskId]);

  // --- HANDLERS ---

  // 1. Update Task Details
  const handleUpdateTask = async () => {
    try {
      // Μετατροπή του date σε ISO format αν χρειάζεται, αλλά το backend το δέχεται και ως string συνήθως
      // Προσθέτουμε ώρα για να είναι valid datetime (π.χ. τέλος της ημέρας) ή το αφήνουμε απλό
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

  // 2. Delete Task
  const handleDeleteTask = async () => {
    if (!window.confirm("Are you sure you want to delete this task?")) return;
    try {
      await api.tasks.delete(taskId);
      navigate(`/admin/teams/${task.team_id}`);
    } catch (err) {
      alert("Failed to delete task.");
    }
  };

  // 3. Add Comment
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

  // 4. Delete Comment
  const handleDeleteComment = async (commentId) => {
    if (!window.confirm("Delete this comment?")) return;
    try {
      await api.tasks.deleteComment(taskId, commentId);
      setComments(comments.filter(c => c.id !== commentId));
    } catch (err) {
      alert("Failed to delete comment.");
    }
  };

  // 5. Upload Attachment
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

  // 6. Download Attachment
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
      console.error("Download error:", err);
      alert("Failed to download file.");
    }
  };

  // 7. Delete Attachment
  const handleDeleteAttachment = async (attachmentId, filename) => {
    if (!window.confirm(`Are you sure you want to delete the file "${filename}"?`)) return;
    try {
      await api.tasks.deleteAttachment(taskId, attachmentId);
      setAttachments(attachments.filter(a => a.id !== attachmentId));
    } catch (err) {
      alert(`Failed to delete file: ${err.response?.data?.detail || 'Unknown error'}`);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading Task...</div>;
  if (!task) return null;

  const getPriorityColor = (p) => {
    if (p === 'URGENT') return 'text-red-600 bg-red-50 border-red-200';
    if (p === 'MEDIUM') return 'text-orange-600 bg-orange-50 border-orange-200';
    return 'text-green-600 bg-green-50 border-green-200';
  };

  return (
    <div className="max-w-5xl mx-auto pb-10">
      {/* BACK BUTTON */}
      <button 
        onClick={() => navigate(`/admin/teams/${task.team_id}`)} 
        className="mb-4 flex items-center text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Team
      </button>

      {/* --- MAIN TASK CARD --- */}
      <div className="bg-white shadow-lg rounded-lg overflow-hidden mb-8 border border-gray-200">
        
        {/* HEADER (Editable) */}
        <div className="p-6 border-b border-gray-100 bg-gray-50">
            {isEditing ? (
                <div className="space-y-4">
                    {/* Title Edit */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Task Title</label>
                        <input 
                            type="text"
                            className="w-full text-xl font-bold border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                            value={editForm.title}
                            onChange={(e) => setEditForm({...editForm, title: e.target.value})}
                        />
                    </div>

                    {/* Meta Edits (Row) */}
                    <div className="flex flex-wrap gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Status</label>
                            <select 
                                className="border p-2 rounded text-sm bg-white outline-none"
                                value={editForm.status}
                                onChange={(e) => setEditForm({...editForm, status: e.target.value})}
                            >
                                <option value="TODO">TODO</option>
                                <option value="IN_PROGRESS">IN PROGRESS</option>
                                <option value="DONE">DONE</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Priority</label>
                            <select 
                                className="border p-2 rounded text-sm bg-white outline-none"
                                value={editForm.priority}
                                onChange={(e) => setEditForm({...editForm, priority: e.target.value})}
                            >
                                <option value="LOW">LOW</option>
                                <option value="MEDIUM">MEDIUM</option>
                                <option value="URGENT">URGENT</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Due Date</label>
                            <input 
                                type="date"
                                className="border p-2 rounded text-sm bg-white outline-none"
                                value={editForm.due_date}
                                onChange={(e) => setEditForm({...editForm, due_date: e.target.value})}
                            />
                        </div>
                    </div>

                    {/* Save/Cancel Buttons */}
                    <div className="flex space-x-2 pt-2">
                        <button onClick={handleUpdateTask} className="flex items-center bg-green-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-green-700">
                            <Save className="w-4 h-4 mr-2" /> Save Changes
                        </button>
                        <button onClick={() => setIsEditing(false)} className="flex items-center bg-gray-500 text-white px-4 py-2 rounded text-sm font-medium hover:bg-gray-600">
                            <X className="w-4 h-4 mr-2" /> Cancel
                        </button>
                    </div>
                </div>
            ) : (
                // VIEW MODE
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
                            {task.title}
                            <button 
                                onClick={() => setIsEditing(true)} 
                                className="text-gray-400 hover:text-blue-600 transition-colors" 
                                title="Edit Task"
                            >
                                <Edit2 className="w-5 h-5" />
                            </button>
                        </h1>
                        <div className="flex items-center space-x-3 text-sm">
                            <span className={`px-2 py-1 rounded border text-xs font-bold ${getPriorityColor(task.priority)}`}>
                                {task.priority}
                            </span>
                            <span className="flex items-center text-gray-500">
                                <div className={`w-2 h-2 rounded-full mr-2 ${task.status === 'DONE' ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                                {task.status.replace('_', ' ')}
                            </span>
                        </div>
                    </div>
                    <button onClick={handleDeleteTask} className="text-red-500 hover:bg-red-50 p-2 rounded transition" title="Delete Task">
                        <Trash2 className="w-6 h-6" />
                    </button>
                </div>
            )}
        </div>
        
        {/* BODY SECTION */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Left: Description */}
            <div className="md:col-span-2 space-y-4">
                <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Description</h3>
                    {isEditing ? (
                        <textarea 
                            className="w-full border p-3 rounded-lg text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
                            rows="6"
                            value={editForm.description}
                            onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                            placeholder="Task description..."
                        />
                    ) : (
                        <div className="text-gray-700 whitespace-pre-wrap leading-relaxed bg-white">
                            {task.description || <span className="italic text-gray-400">No description provided.</span>}
                        </div>
                    )}
                </div>
            </div>

            {/* Right: Meta Info (Not editable directly here, managed via dropdowns above or separate logic) */}
            <div className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-100 h-fit">
                <div className="flex items-center">
                    <User className="w-4 h-4 text-gray-400 mr-3" />
                    <div>
                        <div className="text-xs text-gray-400 uppercase">Assigned To</div>
                        <Link to={`/admin/users/${task.assigned_to}`} className="text-sm font-medium text-blue-600 hover:underline">
                            {task.assigned_to}
                        </Link>
                    </div>
                </div>
                <div className="flex items-center">
                    <Flag className="w-4 h-4 text-gray-400 mr-3" />
                    <div>
                        <div className="text-xs text-gray-400 uppercase">Created By</div>
                        <span className="text-sm font-medium text-gray-700">{task.created_by}</span>
                    </div>
                </div>
                <div className="flex items-center">
                    <Calendar className="w-4 h-4 text-gray-400 mr-3" />
                    <div>
                        <div className="text-xs text-gray-400 uppercase">Due Date</div>
                        <span className="text-sm font-medium text-gray-700">
                            {new Date(task.due_date).toLocaleDateString()}
                        </span>
                    </div>
                </div>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* --- ATTACHMENTS SECTION --- */}
        <div className="bg-white shadow rounded-lg p-6 h-fit">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-700 flex items-center">
                    <Paperclip className="w-5 h-5 mr-2" /> Attachments ({attachments.length})
                </h3>
                <label className="cursor-pointer text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded flex items-center transition">
                    <Plus className="w-3 h-3 mr-1" /> 
                    {uploading ? 'Uploading...' : 'Upload'}
                    <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                </label>
            </div>

            <ul className="space-y-2">
                {attachments.map(file => (
                    <li key={file.id} className="flex justify-between items-center p-3 bg-gray-50 rounded border border-gray-100 hover:bg-blue-50 transition group">
                        <div className="flex items-center overflow-hidden">
                            <Paperclip className="w-4 h-4 text-gray-400 mr-3 flex-shrink-0" />
                            <div className="flex flex-col">
                                <span className="text-sm text-gray-700 truncate font-medium" title={file.filename}>{file.filename}</span>
                                <span className="text-xs text-gray-400">by {file.uploaded_by}</span>
                            </div>
                        </div>
                        
                        <div className="flex space-x-2">
                            <button 
                                onClick={() => handleDownload(file.id, file.filename)}
                                className="text-blue-500 hover:text-blue-700 p-1 rounded hover:bg-blue-100"
                                title="Download"
                            >
                                <Download className="w-4 h-4" />
                            </button>
                            
                            <button 
                                onClick={() => handleDeleteAttachment(file.id, file.filename)}
                                className="text-gray-400 hover:text-red-600 p-1 rounded hover:bg-red-100 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Delete File"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </li>
                ))}
                {attachments.length === 0 && (
                    <li className="text-sm text-gray-400 italic text-center py-4">No files attached yet.</li>
                )}
            </ul>
        </div>

        {/* --- COMMENTS SECTION --- */}
        <div className="bg-white shadow rounded-lg p-6">
            <h3 className="font-bold text-gray-700 flex items-center mb-4">
                <MessageSquare className="w-5 h-5 mr-2" /> Comments ({comments.length})
            </h3>

            {/* Comments List */}
            <div className="space-y-4 mb-6 max-h-[400px] overflow-y-auto pr-2">
                {comments.map(comment => (
                    <div key={comment.id} className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <div className="flex justify-between items-start mb-1">
                            <div className="flex items-center">
                                <span className="text-sm font-bold text-gray-800 mr-2">{comment.created_by}</span>
                                <span className="text-xs text-gray-400 flex items-center">
                                    <Clock className="w-3 h-3 mr-1" />
                                    {new Date(comment.created_at).toLocaleString()}
                                </span>
                            </div>
                            <button 
                                onClick={() => handleDeleteComment(comment.id)}
                                className="text-gray-400 hover:text-red-500 transition"
                            >
                                <Trash2 className="w-3 h-3" />
                            </button>
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.text}</p>
                    </div>
                ))}
                {comments.length === 0 && (
                    <p className="text-sm text-gray-400 italic text-center">No comments yet. Be the first!</p>
                )}
            </div>

            {/* Add Comment Form */}
            <form onSubmit={handleAddComment} className="relative">
                <textarea
                    className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                    rows="3"
                    placeholder="Write a comment..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                ></textarea>
                <div className="flex justify-end mt-2">
                    <button 
                        type="submit" 
                        disabled={!commentText.trim()}
                        className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
                    >
                        Post Comment
                    </button>
                </div>
            </form>
        </div>

      </div>
    </div>
  );
}