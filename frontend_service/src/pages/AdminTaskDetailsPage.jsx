import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api/endpoints';
import { 
    Calendar, User, Flag, Paperclip, MessageSquare, 
    Download, ArrowLeft, Clock
} from 'lucide-react';

export default function AdminTaskDetailsPage() {
  const { taskId } = useParams();
  const navigate = useNavigate();

  // Data State
  const [task, setTask] = useState(null);
  const [team, setTeam] = useState(null);
  const [comments, setComments] = useState([]);
  const [attachments, setAttachments] = useState([]);
  
  // UI State
  const [loading, setLoading] = useState(true);

  // --- INITIAL FETCH ---
  const fetchData = async () => {
    try {
      // 1. Φέρνουμε το Task
      const { data: taskData } = await api.tasks.getDetails(taskId);
      setTask(taskData);
      
      // 2. Φέρνουμε Team (για context μελών), Comments, Attachments
      const [teamRes, commentsRes, attachmentsRes] = await Promise.all([
        api.teams.getOne(taskData.team_id),
        api.tasks.getComments(taskId),
        api.tasks.getAttachments(taskId)
      ]);
      
      setTeam(teamRes.data);
      setComments(commentsRes.data);
      setAttachments(attachmentsRes.data);

    } catch (err) {
      console.error(err);
      alert("Failed to load task details.");
      navigate('/admin/teams');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [taskId]);

  // --- HANDLER ΜΟΝΟ ΓΙΑ DOWNLOAD ---
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

      {/* --- MAIN TASK CARD (READ ONLY) --- */}
      <div className="bg-white shadow-lg rounded-lg overflow-hidden mb-8 border border-gray-200">
        <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-start">
            <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{task.title}</h1>
                <div className="flex items-center space-x-3 text-sm">
                    <span className={`px-2 py-1 rounded border text-xs font-bold ${getPriorityColor(task.priority)}`}>
                        {task.priority}
                    </span>
                    <span className={`flex items-center px-2 py-1 rounded border text-xs font-bold
                        ${task.status === 'DONE' ? 'bg-green-100 text-green-700 border-green-200' : 
                          task.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700 border-blue-200' : 
                          'bg-gray-100 text-gray-700 border-gray-200'}`}>
                        {task.status.replace('_', ' ')}
                    </span>
                </div>
            </div>
            {/* Admin: No Delete/Edit Buttons here */}
        </div>
        
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Description */}
            <div className="md:col-span-2 space-y-4">
                <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Description</h3>
                    <div className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {task.description || <span className="italic text-gray-400">No description provided.</span>}
                    </div>
                </div>
            </div>

            {/* Meta Info */}
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
        
        {/* --- ATTACHMENTS (VIEW ONLY) --- */}
        <div className="bg-white shadow rounded-lg p-6 h-fit">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-700 flex items-center">
                    <Paperclip className="w-5 h-5 mr-2" /> Attachments ({attachments.length})
                </h3>
                {/* Admin: No Upload Button */}
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
                        <button 
                            onClick={() => handleDownload(file.id, file.filename)}
                            className="text-blue-500 hover:text-blue-700 p-1"
                            title="Download"
                        >
                            <Download className="w-4 h-4" />
                        </button>
                        {/* Admin: No Delete Button */}
                    </li>
                ))}
                {attachments.length === 0 && (
                    <li className="text-sm text-gray-400 italic text-center py-4">No files attached.</li>
                )}
            </ul>
        </div>

        {/* --- COMMENTS (VIEW ONLY) --- */}
        <div className="bg-white shadow rounded-lg p-6">
            <h3 className="font-bold text-gray-700 flex items-center mb-4">
                <MessageSquare className="w-5 h-5 mr-2" /> Comments ({comments.length})
            </h3>

            {/* Comments List */}
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                {comments.map(comment => {
                    const isMember = team && team.member_ids.includes(comment.created_by);
                    const isLeader = team && team.leader_id === comment.created_by;
                    const isFormerMember = team && !isMember && !isLeader;

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

                                    <span className="text-xs text-gray-400 flex items-center">
                                        <Clock className="w-3 h-3 mr-1" />
                                        {new Date(comment.created_at).toLocaleString()}
                                    </span>
                                </div>
                                {/* Admin: No Delete Button */}
                            </div>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.text}</p>
                        </div>
                    );
                })}
                {comments.length === 0 && (
                    <p className="text-sm text-gray-400 italic text-center">No comments yet.</p>
                )}
            </div>
            {/* Admin: No "Post Comment" Form */}
        </div>

      </div>
    </div>
  );
}