import { userClient, teamClient, taskClient } from './axios';

export const api = {
    auth: {
        login: (credentials) => {
            const formData = new URLSearchParams();
            formData.append('username', credentials.username);
            formData.append('password', credentials.password);
            
            return userClient.post('/users/token', formData, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });
        },
        signup: (data) => userClient.post('/users', data),
        getMe: () => userClient.get('/users/me'),
    },
    users: {
        getAll: () => userClient.get('/users'),
        getOne: (username) => userClient.get(`/users/${username}`),
        activate: (username) => userClient.patch(`/users/${username}/activate`),
        deactivate: (username) => userClient.patch(`/users/${username}/deactivate`),
        delete: (username) => userClient.delete(`/users/${username}`),
        updateRole: (username, newRole) => userClient.patch(`/users/${username}/role`, { role: newRole }),
    },
    teams: {
        getAll: () => teamClient.get('/teams'),
        getOne: (id) => teamClient.get(`/teams/${id}`),
        create: (data) => teamClient.post('/teams', data),
        update: (id, data) => teamClient.patch(`/teams/${id}`, data),
        delete: (id) => teamClient.delete(`/teams/${id}`),
        
        addMember: (teamId, username) => teamClient.post(`/teams/${teamId}/members`, null, { params: { username } }),
        removeMember: (teamId, username) => teamClient.delete(`/teams/${teamId}/members/${username}`),
        assignLeader: (teamId, username) => teamClient.patch(`/teams/${teamId}/assign-leader`, null, { params: { username } }),
    },
    tasks: {
        getMyTasks: (filters = {}) => taskClient.get('/tasks/me', { params: filters }),
        getByTeam: (teamId, filters = {}) => taskClient.get(`/tasks/team/${teamId}`, { params: filters }),
        create: (data) => taskClient.post('/tasks', data),
        getDetails: (id) => taskClient.get(`/tasks/${id}`),
        updateDetails: (id, data) => taskClient.patch(`/tasks/${id}`, data),
        updateStatus: (taskId, status) => taskClient.patch(`/tasks/${taskId}/status`, { status }),
        delete: (id) => taskClient.delete(`/tasks/${id}`),
        
        addComment: (taskId, text) => taskClient.post(`/tasks/${taskId}/comments`, { text }),
        getComments: (taskId) => taskClient.get(`/tasks/${taskId}/comments`),
        deleteComment: (taskId, commentId) => taskClient.delete(`/tasks/${taskId}/comments/${commentId}`),

        uploadAttachment: (taskId, formData) => taskClient.post(`/tasks/${taskId}/attachments`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        }),
        getAttachments: (taskId) => taskClient.get(`/tasks/${taskId}/attachments`),
        downloadFile: (taskId, attachmentId) => taskClient.get(`/tasks/${taskId}/attachments/${attachmentId}`, {
            responseType: 'blob', // Σημαντικό: Λέμε στο Axios ότι περιμένουμε binary αρχείο
        }), 
        deleteAttachment: (taskId, attachmentId) => taskClient.delete(`/tasks/${taskId}/attachments/${attachmentId}`),
    }
};