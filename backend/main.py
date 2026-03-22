"""
main.py - Fantasy Football AI Optimizer entry point
"""
from loguru import logger
from agents.fantasy_agent import build_fantasy_agent, run_agent


def run_interactive_chat():
    print("\n" + "="*60)
    print("🏈  Fantasy Football AI Optimizer")
    print("="*60)
    print("Ask me anything about your fantasy team!")
    print("Examples:")
    print("  • Should I start Josh Allen or Lamar Jackson?")
    print("  • Analyze this trade: I give Davante Adams for Travis Kelce")
    print("  • What's the latest on Tyreek Hill's injury?")
    print("\nType 'quit' to exit.\n")

    agent = build_fantasy_agent()
    chat_history = []

    while True:
        user_input = input("You: ").strip()
        if user_input.lower() in ("quit", "exit", "q"):
            break
        if not user_input:
            continue

        response = run_agent(agent, user_input, chat_history)
        print(f"\n🤖 Agent: {response}\n")

        from langchain_core.messages import HumanMessage, AIMessage
        chat_history.append(HumanMessage(content=user_input))
        chat_history.append(AIMessage(content=response))
        chat_history = chat_history[-20:]  # Keep last 10 exchanges


if __name__ == "__main__":
    run_interactive_chat()