import { useQuery } from '@tanstack/react-query'
import { supabase } from '../utils/supabase'

interface Todo {
  id: string | number
  name: string
}

async function getTodos() {
  const { data, error } = await supabase.from('todos').select('id, name')

  if (error) throw error

  return data as Todo[]
}

export function TodosPage() {
  const { data: todos = [], error, isLoading } = useQuery({
    queryKey: ['supabase', 'todos'],
    queryFn: getTodos,
  })

  if (isLoading) return <p role="status">Loading todos...</p>
  if (error) return <p role="alert">Unable to load todos: {error.message}</p>

  return (
    <ul>
      {todos.map((todo) => (
        <li key={todo.id}>{todo.name}</li>
      ))}
    </ul>
  )
}
