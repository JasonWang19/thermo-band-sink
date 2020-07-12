
const tokens = {
    admin: {
        token: 'admin-token'
    },
    editor: {
        token: 'editor-token'
    }
}

const users = {
    'admin-token': {
        roles: ['admin'],
        introduction: 'I am a super administrator',
        avatar: 'https://wpimg.wallstcn.com/f778738c-e4f8-4870-b634-56703b4acafe.gif',
        name: 'Super Admin',
        id: 'org-00015'
    },
    'editor-token': {
        roles: ['editor'],
        introduction: 'I am an editor',
        avatar: 'https://wpimg.wallstcn.com/f778738c-e4f8-4870-b634-56703b4acafe.gif',
        name: 'Normal Editor'
    }
}


module.exports = {
    loginHandler(data) {
        const { username } = data.body
        const token = tokens[username]

        // mock error
        if (!token) {
            return {
                code: 60204,
                message: 'Account and password are incorrect.'
            }
        }

        return {
            code: 20000,
            user: token

        }
    },
    getUserInfoHandler(data) {
        const { token } = data.query
        const info = users[token]

        // mock error
        if (!info) {
            return {
                code: 50008,
                message: 'Login failed, unable to get user details.'
            }
        }

        return {
            code: 20000,
            user: info
        }

    },
    logOutHandler() {
        return {
            code: 20000,
            user: 'success'
        }
    }

};