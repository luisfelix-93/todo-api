const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const JiraApi = require('jira-connector');
const app = express();
const jira = new JiraApi({
  host: 'code7',
  basic_auth: {
    username: 'luis.ffilho@code7.com',
    password: 'Luisf@123'
  }
});
const PORT = 3001;

//Configurar o middleware para lidar com requisições JSON
app.use(express.json());
app.use(cors());

//Conectar ao banco de dados MongoDB
mongoose.connect('mongodb://localhost:27017/todo-list',{
    useNewUrlParser: true,
    useUnifiedTopology: true,
});
const db = mongoose.connection;

db.on('error', console.error.bind(console, 'Erro de conexão com o MongoDB:'));
db.once('open', () => {
  console.log('Conectado ao banco de dados MongoDB');
});

// Configurações do Jira
// const jiraClientId = 'SEU_CLIENT_ID';
// const jiraClientSecret = 'SEU_CLIENT_SECRET';
const jiraRedirectUri = 'http://localhost:3000/api/callback'; // URL de redirecionamento após o login

//Definir o modelo de dados do ToDo
const todoSchema = new mongoose.Schema({
  text: String,
  date: Date,
  startTime: String,
  timeSpent: String,
  notes: String,
});

const tokenSchema = new mongoose.Schema({
    client_id:String,
    accessToken: String,
    refreshToken: String
});

// const todoSchema = new mongoose.Schema({
//   {
//     "comment": {
//       "content": [
//         {
//           "content": [
//             {
//               "text": String,
//               "type": String
//             }
//           ],
//           "type": String
//         }
//       ],
//       "type": String,
//       "version": String
//     },
//     "started": String,
//     "timeSpentSeconds": String,
//   }
// });

const Todo = mongoose.model('Todo', todoSchema);
const TokenSchema = mongoose.model('Token',tokenSchema)

// Definir as rotas da API

/*
Rota de login da API
*/
app.get('/api/login', (req, res) => {
    const redirectUrl = `https://code7.atlassian.net/secure/Signup!default.jspa?application=jira&externalLogin=true&continue=${jiraRedirectUri}&clientId=${jiraClientId}`;

})

app.post('/api/callback', async (req, res) => {
    const { code, jiraClientId, jiraClientSecret } = req.body;
  
    try {
      // Troca o código de autorização por um token de acesso
      const tokenResponse = await axios.post(
        'https://code7.atlassian.net/oauth/token',
        querystring.stringify({
          grant_type: 'authorization_code',
          client_id: jiraClientId,
          client_secret: jiraClientSecret,
          redirect_uri: jiraRedirectUri,
          code
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
  
      const accessToken = tokenResponse.data.access_token;
      const refreshToken = tokenResponse.data.refresh_token;

      const newTokenSchema = TokenSchema({
        client_id,
        accessToken, 
        refreshToken
      })
      await newTokenSchema.save();
  
      // Faça algo com os tokens, como armazená-los no banco de dados para autenticação futura
  
      res.status(200).json({ success: true, content: newTokenSchema });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, error: 'Erro durante o processo de login' });
    }
  });

app.get('/api/get-todos', async (req, res) => {
  try {
    const todos = await Todo.find();
    res.json(todos);
  } catch (error) {
    res.status(500).json({ error: 'Ocorreu um erro ao buscar os todos' });
  }
});

app.post('/api/post-todos', async (req, res) => {
  try {
    const newTodo = new Todo(req.body);
    await newTodo.save();
    res.status(201).json(newTodo);
  } catch (error) {
    res.status(500).json({ error: 'Ocorreu um erro ao criar o todo', error });
  }
});

// Atualizar uma tarefa
app.put('/api/upload-todos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updatedTodo = req.body;
    const result = await Todo.findByIdAndUpdate(id, updatedTodo, { new: true });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Ocorreu um erro ao atualizar o todo' });
  }
});

// Excluir uma tarefa
app.delete('/api/delete-todos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await Todo.findByIdAndDelete(id);
    res.json({ message: 'Tarefa excluída com sucesso' });
  } catch (error) {
    res.status(500).json({ error: 'Ocorreu um erro ao excluir o todo' });
  }
});

app.get('/api/get-todo-by-data', async(req, res) =>{
  const date = req.query;
  try{
    const todo = await Todo.find({date: new Date(date)});
    res.status(200).json({success: true, todo});
  } catch(error){
    res.status(500).send('Problema ao procurar tarefa no banco de dados');
    console.log(error);
  }
});

app.get('/api/get-worklog', async(req, res) => {
  const issueKey = req.params.issueKey;
  jira.issue.getWorkLogs({ issueKey: issueKey }, (error, worklogs) => {
    if (error) {
      console.log(error);
      res.status(500).send('Error fetching worklogs');
    } else {
      res.send(worklogs);
    }
  });
});

// Iniciar o servidor
app.listen(PORT, () => {
  console.log(`Servidor iniciado na porta ${PORT}`);
});

